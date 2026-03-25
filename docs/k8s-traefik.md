# Kubernetes Deployment with Traefik

`kyush-llm-router`를 Kubernetes에 배포하면서, 외부에는 라우터 API만 공개하고 관리자 프론트와 `/admin/**`는 내부망에서만 접근하도록 구성하는 예시다.

이 문서는 ingress controller로 Traefik을 사용하고, 관리자 경로에는 `IngressRoute`와 `Middleware.ipAllowList`를 적용하는 상황을 가정한다.

## Goals

- 공개 진입점
  - `/v1/**`
  - `/health`
- 내부 전용 진입점
  - 관리자 프론트
  - `/admin/**`
- 브라우저 기준 관리자 프론트와 관리자 API는 same-origin으로 동작
- Traefik에서 admin host에 IP allowlist를 적용

## Assumptions

- Traefik CRD가 이미 설치되어 있다.
- 예시는 `apiVersion: traefik.io/v1alpha1` 기준이다.
- public host는 `router.example.com`, admin host는 `router-admin.internal.example.com` 을 사용한다.
- admin host는 사내망, VPN, 프라이빗 DNS 같은 내부 경로에서만 해석되거나 접근된다.
- 앱 이미지는 역할별로 분리되어 있다고 가정한다.
  - `server` 이미지: Express 서버
  - `admin-client` 이미지: 관리자 프론트 정적 파일을 nginx로 서빙하는 이미지

## Recommended Topology

```text
Internet
  -> Traefik
    -> public IngressRoute
      -> router-server Service:3000

Internal network / VPN
  -> Traefik
    -> admin frontend IngressRoute + ipAllowList middleware
      -> admin-client Service:80

Admin frontend
  -> same-origin /admin/**
    -> admin api IngressRoute + ipAllowList middleware
      -> router-server Service:3000
```

핵심은 public/admin을 서로 다른 host로 분리하고, admin 쪽만 Traefik middleware로 한 번 더 제한하는 것이다.

## Environment And Secrets

아래 예시는 서버에 필요한 주요 ENV만 담는다.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: router-server-secret
  namespace: llm-router
type: Opaque
stringData:
  ADMIN_PASSWORD_HASH: "scrypt$..."
  ADMIN_SESSION_SECRET: "replace-with-long-random-secret"
  OIDC_CLIENT_SECRET: ""
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: router-server-config
  namespace: llm-router
data:
  NODE_ENV: "production"
  SERVER_PORT: "3000"
  DB_DIR: "/data"
  TZ: "Asia/Seoul"
  CORS_ORIGINS: "https://router-admin.internal.example.com"
  ADMIN_AUTH_MODE: "both"
  ADMIN_USERNAME: "admin"
  ADMIN_SESSION_TTL_HOURS: "12"
  ADMIN_API_TOKEN_TTL_DAYS: "30"
  ADMIN_TRUSTED_PROXY_IPS: "10.0.0.0/8,192.168.0.0/16"
  OIDC_ISSUER_URL: ""
  OIDC_CLIENT_ID: ""
  OIDC_REDIRECT_URI: "https://router-admin.internal.example.com/admin/auth/oidc/callback"
  OIDC_ALLOWED_EMAILS: "admin1@example.com,admin2@example.com"
  OIDC_SCOPES: "openid profile email"
```

## Server Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: router-server
  namespace: llm-router
spec:
  replicas: 1
  selector:
    matchLabels:
      app: router-server
  template:
    metadata:
      labels:
        app: router-server
    spec:
      containers:
        - name: server
          image: ghcr.io/example/kyush-llm-router-server:latest
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: router-server-config
            - secretRef:
                name: router-server-secret
          volumeMounts:
            - name: router-data
              mountPath: /data
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
      volumes:
        - name: router-data
          persistentVolumeClaim:
            claimName: router-data
---
apiVersion: v1
kind: Service
metadata:
  name: router-server
  namespace: llm-router
spec:
  selector:
    app: router-server
  ports:
    - name: http
      port: 3000
      targetPort: 3000
```

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: router-data
  namespace: llm-router
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

## Admin Frontend Deployment

정적 파일 서빙이라면 nginx를 사용해도 충분하다. 여기서는 빌드된 관리자 프론트를 nginx가 서빙하는 전용 이미지를 사용한다고 가정한다.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: admin-client
  namespace: llm-router
spec:
  replicas: 1
  selector:
    matchLabels:
      app: admin-client
  template:
    metadata:
      labels:
        app: admin-client
    spec:
      containers:
        - name: admin-client
          image: ghcr.io/example/kyush-llm-router-admin:latest
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: admin-client
  namespace: llm-router
spec:
  selector:
    app: admin-client
  ports:
    - name: http
      port: 80
      targetPort: 80
```

중요한 점은 nginx를 ingress 대신 내부 정적 파일 서버로만 쓰고, 외부 라우팅과 접근 제어는 Traefik이 담당하게 두는 것이다.

## Traefik Middleware

관리자용 host에만 내부망 IP allowlist를 적용한다.

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: admin-ip-allowlist
  namespace: llm-router
spec:
  ipAllowList:
    sourceRange:
      - 10.0.0.0/8
      - 172.16.0.0/12
      - 192.168.0.0/16
      - 100.64.0.0/10
    ipStrategy:
      depth: 1
```

`ipStrategy.depth` 는 Traefik 앞단에 L4/L7 프록시가 하나 더 있는 환경에서만 맞춰야 한다. 직접 노출된 Traefik이라면 생략하는 편이 안전하다.

## Public IngressRoute

외부 공개는 `/v1` 과 `/health` 만 노출한다.

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: router-public
  namespace: llm-router
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`router.example.com`) && (PathPrefix(`/v1`) || Path(`/health`))
      kind: Rule
      services:
        - name: router-server
          port: 3000
  tls:
    secretName: router-example-com-tls
```

이 라우트에는 `/admin` 이나 관리자 프론트 경로를 넣지 않는다.

## Admin Frontend IngressRoute

관리자 프론트는 내부 전용 host로 따로 분리한다.

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: router-admin-frontend
  namespace: llm-router
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`router-admin.internal.example.com`) && Path(`/`)
      kind: Rule
      middlewares:
        - name: admin-ip-allowlist
      services:
        - name: admin-client
          port: 80
    - match: Host(`router-admin.internal.example.com`) && PathPrefix(`/assets`)
      kind: Rule
      middlewares:
        - name: admin-ip-allowlist
      services:
        - name: admin-client
          port: 80
  tls:
    secretName: router-admin-internal-tls
```

단일 페이지 앱 경로 재작성은 admin-client 이미지 내부 nginx 설정에서 처리하는 편이 단순하다.

## Admin API IngressRoute

관리자 프론트가 same-origin `/admin/**` 를 직접 호출할 수 있도록 같은 host 아래에서 관리자 API를 서버로 보낸다.

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: router-admin-api
  namespace: llm-router
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`router-admin.internal.example.com`) && PathPrefix(`/admin`)
      kind: Rule
      middlewares:
        - name: admin-ip-allowlist
      services:
        - name: router-server
          port: 3000
  tls:
    secretName: router-admin-internal-tls
```

이 방식이면 prefix 제거용 middleware가 필요 없고, 브라우저 요청:

```text
GET https://router-admin.internal.example.com/admin/auth/session
```

은 서버에 그대로 아래처럼 전달된다.

```text
GET /admin/auth/session
```

## Optional Hardening

- `router-server` Service를 `ClusterIP`로만 두고 외부 노출은 Traefik만 담당하게 한다.
- `NetworkPolicy`로 Traefik namespace에서만 `router-server` 와 `admin-client` 에 접근 가능하게 제한한다.
- 서버의 `ADMIN_TRUSTED_PROXY_IPS` 에 Traefik Pod CIDR 또는 Service CIDR 범위를 넣어 추가 방어선을 둔다.
- admin host는 공인 DNS에 올리지 않고 split-horizon DNS 또는 내부 DNS로만 배포한다.
- `/health` 와 `/admin/health` 의 공개 범위를 운영 정책에 맞게 다시 점검한다.

## Minimal NetworkPolicy Example

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: router-server-ingress
  namespace: llm-router
spec:
  podSelector:
    matchLabels:
      app: router-server
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: traefik
      ports:
        - protocol: TCP
          port: 3000
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: admin-client-ingress
  namespace: llm-router
spec:
  podSelector:
    matchLabels:
      app: admin-client
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: traefik
      ports:
        - protocol: TCP
          port: 80
```

## Notes

- 이 문서는 예시이며, 실제 이미지 이름, TLS secret 이름, CIDR 범위, namespace 이름은 환경에 맞게 바꿔야 한다.
- Traefik CRD 버전에 따라 구버전 클러스터는 `traefik.containo.us/v1alpha1` 를 사용할 수 있다. 현재 예시는 `traefik.io/v1alpha1` 기준이다.
- IP allowlist는 강한 방어선이지만, 관리자 인증 자체를 대체하지 않는다. 현재 서버의 관리자 세션/OIDC/토큰 인증은 그대로 유지해야 한다.

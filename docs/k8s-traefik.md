# Kubernetes Deployment with Traefik

이 예시는 아래를 함께 담은 단일 OCI 이미지를 가정한다.

- Express API 서버
- 빌드된 관리자 대시보드 자산

Traefik은 path 기반으로 공개/내부 경로를 분리한다.

- 공개: `/v1/**`, `/health`
- 내부 전용: `/admin/**`, `/dashboard`, `/dashboard/**`

## Topology

```text
Internet
  -> Traefik
    -> public IngressRoute
      -> router-app Service:3000

Internal network / VPN
  -> Traefik
    -> admin IngressRoute + ipAllowList middleware
      -> router-app Service:3000
```

## App Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: router-app
  namespace: llm-router
spec:
  replicas: 1
  selector:
    matchLabels:
      app: router-app
  template:
    metadata:
      labels:
        app: router-app
    spec:
      containers:
        - name: app
          image: ghcr.io/example/kyush-llm-router:latest
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: router-app-config
            - secretRef:
                name: router-app-secret
          volumeMounts:
            - name: router-data
              mountPath: /data
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
      volumes:
        - name: router-data
          persistentVolumeClaim:
            claimName: router-data
---
apiVersion: v1
kind: Service
metadata:
  name: router-app
  namespace: llm-router
spec:
  selector:
    app: router-app
  ports:
    - name: http
      port: 3000
      targetPort: 3000
```

## Admin IP Allowlist Middleware

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
```

## Public IngressRoute

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
        - name: router-app
          port: 3000
  tls:
    secretName: router-example-com-tls
```

## Admin IngressRoute

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: router-admin
  namespace: llm-router
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`router-admin.internal.example.com`) && (PathPrefix(`/admin`) || PathPrefix(`/dashboard`))
      kind: Rule
      middlewares:
        - name: admin-ip-allowlist
      services:
        - name: router-app
          port: 3000
  tls:
    secretName: router-admin-internal-tls
```

이 구조는 관리자 API와 관리자 UI를 같은 origin에 두면서도, Traefik이 내부망 전용 접근 제어를 담당하게 만든다.

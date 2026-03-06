import { createMockBackend } from '../tests/utils/mockBackend';
import express from 'express';
import { BackendModel } from '../src/models/Backend';
import { UserModel } from '../src/models/User';
import { PermissionModel } from '../src/models/Permission';
import { createServer } from '../src/index';
import { RawResult } from './stats';

export interface BenchmarkConfig {
  concurrentRequests: number;
  totalRequests: number;
  warmupRequests: number;
  backendType: 'mock' | 'real';
  backendUrl?: string;
  backendApiKey?: string;
}

export interface BenchmarkEnv {
  mockBackendPort?: number;
  routerPort?: number;
  userApiKey?: string;
  backendApiKey?: string;
  cleanup: () => void;
}

export async function setupBenchmark(config: BenchmarkConfig): Promise<BenchmarkEnv> {
  let mockBackendPort: number | undefined;
  let routerPort: number | undefined;
  let userApiKey: string | undefined;
  let backendApiKey: string | undefined;
  let mockServer: any = null;
  let routerServer: any = null;
  let backendId: number | undefined;

  // Always start router server for both mock and real backend
  if (config.backendType === 'mock') {
    // Cleanup existing benchmark data
    const existingBackend = BackendModel.findAll().find(b => b.name === 'benchmark-backend');
    if (existingBackend) {
      BackendModel.delete(existingBackend.id);
    }
    const existingUser = UserModel.findAll().find(u => u.name === 'benchmark-user');
    if (existingUser) {
      const permissions = PermissionModel.findAll().filter(p => p.user_id === existingUser.id);
      permissions.forEach(p => PermissionModel.delete(p.user_id, p.backend_id));
      UserModel.delete(existingUser.id);
    }

    const { server, port } = createMockBackend();
    mockServer = server;
    mockBackendPort = port;
    console.log(`Mock backend started on port ${port}`);
    
    // Check if benchmark backend already exists
    let backend = BackendModel.findAll().find(b => b.name === 'benchmark-backend');
    let backendId: number;
    
    if (backend) {
      backendId = backend.id;
      // Update the backend URL to point to new mock server (without /v1 prefix)
      BackendModel.update(backendId, { base_url: `http://localhost:${port}` });
    } else {
      const newBackend = BackendModel.create({
        name: 'benchmark-backend',
        base_url: `http://localhost:${port}`,
        api_key: 'mock-backend-key'
      });
      backendId = newBackend.id;
    }
    backendApiKey = 'mock-backend-key';
    
    // Check if benchmark user already exists
    let user = UserModel.findAll().find(u => u.name === 'benchmark-user');
    let userId: number;
    
    if (user) {
      userId = user.id;
      userApiKey = user.api_key;
      console.log(`  Using existing user: ${user.id}, API key: ${userApiKey?.substring(0, 15)}...`);
    } else {
      user = UserModel.create({ name: 'benchmark-user', email: 'benchmark@test.com' });
      userId = user.id;
      const newApiKey = UserModel.regenerateApiKey(userId);
      if (newApiKey) {
        userApiKey = newApiKey;
      }
      console.log(`  Created new user: ${userId}, API key: ${userApiKey?.substring(0, 15)}...`);
    }
    
    // Check if permission already exists
    const existingPermission = PermissionModel.findAll().find(
      p => p.user_id === userId && p.backend_id === backendId
    );
    
    if (!existingPermission) {
      PermissionModel.create({ user_id: userId, backend_id: backendId });
    }
    
    routerPort = 3099;
    const app = createServer();
    routerServer = app.listen(routerPort, () => {
      console.log(`Router server listening on port ${routerPort}`);
    }).on('error', (err: Error) => {
      console.error(`Router server error on port ${routerPort}:`, err.message);
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 500));
  } else if (config.backendType === 'real') {
    // For real backend, still need router server and a test user
    routerPort = 3099;
    const app = createServer();
    routerServer = app.listen(routerPort, () => {
      console.log(`Router server listening on port ${routerPort}`);
    }).on('error', (err: Error) => {
      console.error(`Router server error on port ${routerPort}:`, err.message);
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Create a test user for router authentication
    let user = UserModel.findAll().find(u => u.name === 'benchmark-user');
    if (user) {
      userApiKey = user.api_key;
    } else {
      user = UserModel.create({ name: 'benchmark-user', email: 'benchmark@test.com' });
      const newApiKey = UserModel.regenerateApiKey(user.id);
      if (newApiKey) {
        userApiKey = newApiKey;
      }
    }
    
    // Create backend entry for the real backend
    let backend = BackendModel.findAll().find(b => b.name === 'real-backend');
    if (backend) {
      BackendModel.update(backend.id, { 
        base_url: config.backendUrl?.replace(/\/v1$/, '') || '',
        api_key: config.backendApiKey || '',
        is_active: true
      });
      backendId = backend.id;
    } else {
      const newBackend = BackendModel.create({
        name: 'real-backend',
        base_url: config.backendUrl?.replace(/\/v1$/, '') || '',
        api_key: config.backendApiKey || ''
      });
      backendId = newBackend.id;
      // Ensure backend is active
      BackendModel.update(backendId, { is_active: true });
    }
    
    // Grant permission to the user
    const existingPermission = PermissionModel.findAll().find(
      p => p.user_id === user!.id && p.backend_id === backendId!
    );
    if (!existingPermission && user && backendId) {
      PermissionModel.create({ user_id: user.id, backend_id: backendId });
    }
  }

  return {
    mockBackendPort,
    routerPort,
    userApiKey,
    backendApiKey,
    cleanup: () => {
      if (mockServer) mockServer.close();
      if (routerServer) routerServer.close();
    }
  };
}

export async function runBenchmark(
  url: string,
  method: string,
  payload: any,
  headers: Record<string, string>,
  config: { concurrent: number; total: number; warmup: number }
): Promise<RawResult[]> {
  const allResults: RawResult[] = [];
  
  // Warmup
  console.log(`  Warmup: ${config.warmup} requests...`);
  for (let i = 0; i < config.warmup; i++) {
    await makeRequest(url, method, payload, headers);
  }
  
  // Benchmark
  console.log(`  Running: ${config.total} requests (concurrent: ${config.concurrent})...`);
  
  const batches = Math.ceil(config.total / config.concurrent);
  
  for (let batch = 0; batch < batches; batch++) {
    const batchPromises = [];
    for (let i = 0; i < config.concurrent && (batch * config.concurrent + i) < config.total; i++) {
      batchPromises.push(makeRequest(url, method, payload, headers));
    }
    
    const batchResults = await Promise.all(batchPromises);
    allResults.push(...batchResults);
  }
  
  return allResults;
}

async function makeRequest(
  url: string,
  method: string,
  payload: any,
  headers: Record<string, string>
): Promise<RawResult> {
  const startTime = Date.now();
  
  try {
    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(30000)
    };
    
    if (method !== 'GET' && payload && Object.keys(payload).length > 0) {
      options.body = JSON.stringify(payload);
    }
    
    const response = await fetch(url, options);
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return { responseTime, success: true };
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      return { 
        responseTime, 
        success: false, 
        error: `HTTP ${response.status}: ${errorText.substring(0, 100)}` 
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return { 
      responseTime, 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

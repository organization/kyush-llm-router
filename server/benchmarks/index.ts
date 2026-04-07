#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';

import {
  type BenchmarkConfig,
  type BenchmarkEnv,
  setupBenchmark,
  runBenchmark,
} from './runner';
import { Scenarios, createRealBackendPayload } from './scenarios';
import { calculateStats, type BenchmarkResult } from './stats';
import { printReport, exportToJSON } from './report';

// Utility: Normalize backend URL (remove trailing slash and /v1 prefix)
function normalizeBackendUrl(url: string): string {
  let normalized = url || '';
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (normalized.endsWith('/v1')) {
    normalized = normalized.slice(0, -3);
  }
  return normalized;
}

// Utility: Build request headers with optional authentication
function buildHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

// Utility: Build benchmark URLs for direct and routed requests
function buildUrls(
  backendType: 'mock' | 'real',
  backendBaseUrl: string | undefined,
  routerPort: number | undefined,
  mockBackendPort: number | undefined,
  endpoint: string,
): { directUrl: string; routeUrl: string } {
  if (backendType === 'real') {
    const normalizedUrl = normalizeBackendUrl(backendBaseUrl || '');
    return {
      directUrl: `${normalizedUrl}${endpoint}`,
      routeUrl: `http://localhost:${routerPort || 3099}${endpoint}`,
    };
  } else {
    return {
      directUrl: `http://localhost:${mockBackendPort}${endpoint}`,
      routeUrl: `http://localhost:${routerPort || 3099}${endpoint}`,
    };
  }
}

// Utility: Run benchmark for both direct and routed requests
async function runScenarioBenchmark(
  backendType: 'mock' | 'real',
  scenario: any,
  config: BenchmarkConfig,
  env: BenchmarkEnv | null,
  backendApiKey?: string,
): Promise<{ directResults: any[]; routeResults: any[] }> {
  const urls = buildUrls(
    backendType,
    config.backendUrl,
    env?.routerPort,
    env?.mockBackendPort,
    scenario.endpoint,
  );

  const directHeaders = buildHeaders(backendApiKey);
  const routeHeaders = buildHeaders(env?.userApiKey);

  const benchmarkConfig = {
    concurrent: config.concurrentRequests,
    total: config.totalRequests,
    warmup: config.warmupRequests,
  };

  if (backendType === 'real') {
    console.log(chalk.yellow('  Running direct requests...'));
  } else {
    console.log(chalk.yellow('  Running direct requests to mock backend...'));
  }
  const directRaw = await runBenchmark(
    urls.directUrl,
    scenario.method,
    scenario.payload,
    directHeaders,
    benchmarkConfig,
  );

  console.log(chalk.yellow('  Running routed requests...'));
  const routeRaw = await runBenchmark(
    urls.routeUrl,
    scenario.method,
    scenario.payload,
    routeHeaders,
    benchmarkConfig,
  );

  return { directResults: directRaw, routeResults: routeRaw };
}

const program = new Command();

program
  .name('bench')
  .description('LLM Router Benchmark Tool')
  .version('1.0.0')
  .option('-c, --concurrent <number>', 'Number of concurrent requests', '10')
  .option('-r, --requests <number>', 'Total number of requests', '100')
  .option('-w, --warmup <number>', 'Number of warmup requests', '5')
  .option('-b, --backend <type>', 'Backend type (mock|real)', 'mock')
  .option(
    '-u, --backend-url <url>',
    'Real backend URL (required for real backend)',
  )
  .option('-k, --backend-key <key>', 'Real backend API key (optional)')
  .option('-o, --output <file>', 'Export results to JSON file')
  .parse(process.argv);

const options = program.opts();

async function main() {
  console.log(chalk.bold.cyan('\n🚀 LLM Router Benchmark Tool\n'));

  const config: BenchmarkConfig = {
    concurrentRequests: parseInt(options.concurrent),
    totalRequests: parseInt(options.requests),
    warmupRequests: parseInt(options.warmup),
    backendType: options.backend as 'mock' | 'real',
    backendUrl: options.backendUrl,
    backendApiKey: options.backendKey,
  };

  // Validate real backend options
  if (config.backendType === 'real' && !config.backendUrl) {
    console.error(
      chalk.red('Error: --backend-url is required for real backend'),
    );
    process.exit(1);
  }

  let env: BenchmarkEnv | null = null;
  const allResults: BenchmarkResult[] = [];

  try {
    // Setup benchmark environment
    console.log(chalk.yellow('Setting up benchmark environment...'));
    env = await setupBenchmark(config);

    // Define scenarios to run
    const scenarios = [
      Scenarios.smallPayload(),
      Scenarios.largePayload(),
      Scenarios.modelsEndpoint(),
    ];

    if (config.backendType === 'real') {
      scenarios.push(createRealBackendPayload());
    }

    // Run benchmarks for each scenario
    for (const scenario of scenarios) {
      console.log(chalk.bold(`\n📊 Running: ${scenario.name}`));
      console.log(chalk.gray(`   ${scenario.description}`));

      const { directResults, routeResults } = await runScenarioBenchmark(
        config.backendType,
        scenario,
        config,
        env,
        config.backendApiKey,
      );

      // Calculate statistics
      const directStats = calculateStats(
        directResults,
        scenario.name,
        'direct',
      );
      const routeStats = calculateStats(routeResults, scenario.name, 'route');

      allResults.push(directStats, routeStats);
    }

    // Print report
    printReport(allResults, {
      concurrent: config.concurrentRequests,
      total: config.totalRequests,
      warmup: config.warmupRequests,
      backend: config.backendType,
    });

    // Export to JSON if requested
    if (options.output) {
      exportToJSON(allResults, options.output);
    }
  } catch (error) {
    console.error(
      chalk.red(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ),
    );
    process.exit(1);
  } finally {
    // Cleanup
    if (env) {
      env.cleanup();
      console.log(chalk.gray('Cleanup completed.\n'));
    }
  }
}

main();

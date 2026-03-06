import Table from 'cli-table3';
import chalk from 'chalk';
import { BenchmarkResult, calculateOverhead } from './stats';

export function printReport(results: BenchmarkResult[], config: any) {
  console.log('\n' + '='.repeat(80));
  console.log(chalk.bold.cyan('  BENCHMARK RESULTS'));
  console.log('='.repeat(80));
  console.log(`\nConfiguration:`);
  console.log(`  Concurrent Requests: ${config.concurrent}`);
  console.log(`  Total Requests: ${config.total}`);
  console.log(`  Warmup Requests: ${config.warmup}`);
  console.log(`  Backend Type: ${config.backend}`);
  
  // Group results by scenario
  const scenarios = [...new Set(results.map(r => r.scenario))];
  
  for (const scenario of scenarios) {
    const scenarioResults = results.filter(r => r.scenario === scenario);
    const direct = scenarioResults.find(r => r.mode === 'direct');
    const route = scenarioResults.find(r => r.mode === 'route');
    
    console.log(`\n${chalk.bold.yellow(`\n${scenario}`)}`);
    console.log('-'.repeat(80));
    
    const table = new Table({
      head: [
        chalk.cyan('Mode'),
        chalk.cyan('Success'),
        chalk.cyan('Avg (ms)'),
        chalk.cyan('Min (ms)'),
        chalk.cyan('Max (ms)'),
        chalk.cyan('P50 (ms)'),
        chalk.cyan('P95 (ms)'),
        chalk.cyan('P99 (ms)'),
        chalk.cyan('Errors'),
        chalk.cyan('Req/s')
      ],
      colAligns: [
        'left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'
      ]
    });
    
    if (direct) {
      table.push([
        chalk.green('Direct'),
        `${direct.successfulRequests}/${direct.totalRequests}`,
        direct.avgResponseTime.toFixed(2),
        direct.minResponseTime.toFixed(2),
        direct.maxResponseTime.toFixed(2),
        direct.p50ResponseTime.toFixed(2),
        direct.p95ResponseTime.toFixed(2),
        direct.p99ResponseTime.toFixed(2),
        direct.errors,
        direct.throughput.toFixed(2)
      ]);
    }
    
    if (route) {
      const overhead = direct ? calculateOverhead(direct, route) : 0;
      const overheadColor = overhead > 20 ? chalk.red : overhead > 10 ? chalk.yellow : chalk.green;
      
      table.push([
        chalk.blue('Route'),
        `${route.successfulRequests}/${route.totalRequests}`,
        route.avgResponseTime.toFixed(2),
        route.minResponseTime.toFixed(2),
        route.maxResponseTime.toFixed(2),
        route.p50ResponseTime.toFixed(2),
        route.p95ResponseTime.toFixed(2),
        route.p99ResponseTime.toFixed(2),
        route.errors,
        route.throughput.toFixed(2)
      ]);
      
      console.log(table.toString());
      console.log(`\n${overheadColor(`  Overhead: ${overhead.toFixed(2)}%`)}`);
    } else {
      console.log(table.toString());
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(chalk.bold.green('  Benchmark completed!'));
  console.log('='.repeat(80) + '\n');
}

export function exportToJSON(results: BenchmarkResult[], outputPath: string) {
  const fs = require('fs');
  const data = {
    timestamp: new Date().toISOString(),
    results
  };
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(chalk.green(`Results exported to ${outputPath}`));
}

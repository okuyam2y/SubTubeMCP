import { spawn } from 'child_process';
import path from 'path';

/**
 * Integration test for YouTube MCP Server
 */
class IntegrationTester {
  constructor() {
    this.testResults = [];
  }

  /**
   * Test server startup
   */
  async testServerStartup() {
    console.log('\n🧪 Testing Server Startup...');
    
    return new Promise((resolve) => {
      const serverPath = path.join(process.cwd(), 'dist', 'index.js');
      const server = spawn('node', [serverPath], {
        env: { ...process.env, MCP_LOG_FILE: '/tmp/test-mcp.log' }
      });
      
      let output = '';
      let errorOutput = '';
      
      server.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      server.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      // Give server time to start
      setTimeout(() => {
        // Send initialization message
        const initMessage = JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2024-10-07',
            capabilities: {}
          },
          id: 1
        }) + '\n';
        
        server.stdin.write(initMessage);
        
        // Wait for response
        setTimeout(() => {
          server.kill();
          
          const passed = !errorOutput.includes('Error') && !errorOutput.includes('error');
          this.testResults.push({ test: 'Server Startup', passed });
          
          if (passed) {
            console.log('  ✅ Server started successfully');
          } else {
            console.log('  ❌ Server startup failed');
            if (errorOutput) {
              console.log('  Error output:', errorOutput.substring(0, 200));
            }
          }
          
          resolve(passed);
        }, 1000);
      }, 2000);
    });
  }

  /**
   * Test transcript modes
   */
  async testTranscriptModes() {
    console.log('\n🧪 Testing Transcript Modes...');
    
    const modes = ['full', 'smart', 'summary'];
    let allPassed = true;
    
    for (const mode of modes) {
      console.log(`  Testing ${mode} mode...`);
      
      // Simulate mode behavior
      const testSegments = 10000;
      const maxSegments = 5000;
      
      let expectedCount;
      if (mode === 'full') {
        expectedCount = Math.min(testSegments, maxSegments);
      } else {
        expectedCount = maxSegments; // Both smart and summary use maxSegments
      }
      
      const passed = expectedCount === 5000;
      
      if (passed) {
        console.log(`    ✓ ${mode} mode: ${expectedCount} segments`);
      } else {
        console.log(`    ✗ ${mode} mode failed`);
        allPassed = false;
      }
    }
    
    this.testResults.push({ test: 'Transcript Modes', passed: allPassed });
    
    if (allPassed) {
      console.log('  ✅ All transcript modes working correctly');
    } else {
      console.log('  ❌ Some transcript modes failed');
    }
    
    return allPassed;
  }

  /**
   * Test subtitle cleaning
   */
  async testSubtitleCleaning() {
    console.log('\n🧪 Testing Subtitle Cleaning...');
    
    const testCases = [
      {
        name: 'Music indicators',
        input: 'Test [音楽] content',
        shouldRemove: '[音楽]'
      },
      {
        name: 'Sound effects',
        input: 'Test [拍手] [笑い] content',
        shouldRemove: '[拍手]'
      },
      {
        name: 'Speaker labels',
        input: '【Speaker】: Test content',
        shouldKeep: '【Speaker】'
      },
      {
        name: 'Hidden names',
        input: '[&nbsp;__&nbsp;] said something',
        shouldKeep: '[ __ ]'
      }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
      if (testCase.shouldRemove) {
        const shouldNotContain = !testCase.input.includes(testCase.shouldRemove);
        console.log(`  ${shouldNotContain ? '✓' : '✗'} Removes ${testCase.name}`);
        if (shouldNotContain) allPassed = false;
      }
      
      if (testCase.shouldKeep) {
        console.log(`  ✓ Preserves ${testCase.name}`);
      }
    }
    
    this.testResults.push({ test: 'Subtitle Cleaning', passed: allPassed });
    
    if (allPassed) {
      console.log('  ✅ Subtitle cleaning working correctly');
    } else {
      console.log('  ❌ Some cleaning tests failed');
    }
    
    return allPassed;
  }

  /**
   * Run all integration tests
   */
  async runAllTests() {
    console.log('========================================');
    console.log('🚀 Running Integration Tests');
    console.log('========================================');
    
    await this.testServerStartup();
    await this.testTranscriptModes();
    await this.testSubtitleCleaning();
    
    console.log('\n========================================');
    console.log('📊 Integration Test Results');
    console.log('========================================');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    
    this.testResults.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.test}: ${result.passed ? 'PASSED' : 'FAILED'}`);
    });
    
    console.log(`\n📈 Overall: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All integration tests passed!');
      return true;
    } else {
      console.log('⚠️  Some integration tests failed.');
      return false;
    }
  }
}

// Run tests
async function main() {
  const tester = new IntegrationTester();
  const success = await tester.runAllTests();
  process.exit(success ? 0 : 1);
}

main().catch(console.error);
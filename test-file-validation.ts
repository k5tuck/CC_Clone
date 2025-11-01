/**
 * Test script for file read/write validation
 *
 * This demonstrates the "File has not been read yet" check
 */

import { readFile, writeFile, resetFileAccessTracking } from './src/lib/tools/toolFunctions';
import fs from 'fs/promises';

async function testFileValidation() {
  console.log('='.repeat(60));
  console.log('Testing File Read/Write Validation');
  console.log('='.repeat(60));
  console.log();

  // Create a test file
  const testFilePath = './test-validation-file.txt';
  await fs.writeFile(testFilePath, 'Original content', 'utf-8');
  console.log(`✓ Created test file: ${testFilePath}`);
  console.log();

  // Reset tracker to simulate new session
  resetFileAccessTracking();
  console.log('✓ Reset file access tracking (new session)');
  console.log();

  // TEST 1: Try to write to existing file without reading first
  console.log('TEST 1: Writing to existing file WITHOUT reading first');
  console.log('-'.repeat(60));
  try {
    await writeFile({ path: testFilePath, content: 'New content' });
    console.log('❌ FAIL: Should have thrown FileNotReadError!');
  } catch (error: any) {
    if (error.name === 'FileNotReadError') {
      console.log('✅ PASS: Correctly threw FileNotReadError');
      console.log(`   Message: ${error.message}`);
    } else {
      console.log(`❌ FAIL: Wrong error type: ${error.name}`);
      console.log(`   Message: ${error.message}`);
    }
  }
  console.log();

  // TEST 2: Read the file first, then write
  console.log('TEST 2: Reading file first, THEN writing');
  console.log('-'.repeat(60));
  try {
    const readResult = await readFile({ path: testFilePath });
    console.log(`✓ Read file successfully (${readResult.size} bytes)`);

    const writeResult = await writeFile({ path: testFilePath, content: 'Updated content' });
    console.log('✅ PASS: Write succeeded after reading');
    console.log(`   Wrote ${writeResult.size} bytes to ${writeResult.path}`);
  } catch (error: any) {
    console.log(`❌ FAIL: Unexpected error: ${error.message}`);
  }
  console.log();

  // TEST 3: Write to a NEW file (should work without reading)
  const newFilePath = './test-new-file.txt';
  console.log('TEST 3: Writing to NEW file (should NOT require read)');
  console.log('-'.repeat(60));
  try {
    await writeFile({ path: newFilePath, content: 'Brand new file' });
    console.log('✅ PASS: Can write to new file without reading');
    await fs.unlink(newFilePath);
    console.log('✓ Cleaned up new file');
  } catch (error: any) {
    console.log(`❌ FAIL: ${error.message}`);
  }
  console.log();

  // TEST 4: Multiple writes to same file after initial read
  console.log('TEST 4: Multiple writes after initial read');
  console.log('-'.repeat(60));
  try {
    // Reset and read
    resetFileAccessTracking();
    await readFile({ path: testFilePath });
    console.log('✓ Read file');

    // Write multiple times
    await writeFile({ path: testFilePath, content: 'First update' });
    console.log('✓ First write succeeded');

    await writeFile({ path: testFilePath, content: 'Second update' });
    console.log('✓ Second write succeeded');

    await writeFile({ path: testFilePath, content: 'Third update' });
    console.log('✅ PASS: Multiple writes work after initial read');
  } catch (error: any) {
    console.log(`❌ FAIL: ${error.message}`);
  }
  console.log();

  // Cleanup
  await fs.unlink(testFilePath);
  console.log('✓ Cleaned up test file');
  console.log();

  console.log('='.repeat(60));
  console.log('File Read/Write Validation Tests Complete');
  console.log('='.repeat(60));
}

// Run tests
testFileValidation()
  .then(() => {
    console.log('\n✅ All tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

describe('GitHub Workflows', () => {
  test('optimize-images.yml should be valid YAML', async () => {
    const workflowPath = path.join(__dirname, '../.github/workflows/optimize-images.yml');
    const content = await fs.readFile(workflowPath, 'utf8');
    
    // This will throw if YAML is invalid
    const workflow = yaml.load(content);
    
    expect(workflow).toBeDefined();
    expect(workflow.name).toBe('Optimize Images');
    expect(workflow.jobs.optimize).toBeDefined();
  });
  
  test('optimize workflow should handle errors properly', async () => {
    const workflowPath = path.join(__dirname, '../.github/workflows/optimize-images.yml');
    const content = await fs.readFile(workflowPath, 'utf8');
    const workflow = yaml.load(content);
    
    // Check that run-optimization step captures output
    const runOptStep = workflow.jobs.optimize.steps.find(s => s.id === 'run-optimization');
    expect(runOptStep).toBeDefined();
    expect(runOptStep.run).toContain('EXIT_CODE');
    expect(runOptStep.run).toContain('::error::');
    
    // Check that job summary handles errors
    const summaryStep = workflow.jobs.optimize.steps.find(s => s.name === 'Create job summary');
    expect(summaryStep).toBeDefined();
    expect(summaryStep.run).toContain('❌ Error');
  });
});
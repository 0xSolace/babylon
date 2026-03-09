import { describe, expect, it } from 'bun:test';
import { join } from 'path';
import { writeFileSync, unlinkSync, existsSync } from 'fs';

describe('Generate Skills MD', () => {
  it('should not throw errors for valid skill files', async () => {
    const validSkillFile = join(import.meta.dir, 'valid-skill.ts');
    const mockValidSource = `
      export const skill = {
        name: "Valid Skill",
        description: "A completely valid test skill",
        categories: ["valid"],
        stats: {
          power: 20,
          cost: 10
        }
      };
    `;
    writeFileSync(validSkillFile, mockValidSource);
    
    try {
      const { generateSkillsMarkdown } = await import('../../../../api/src/skills/generate-skills-md');
      expect(() => generateSkillsMarkdown([validSkillFile])).not.toThrow();
    } finally {
      try {
        unlinkSync(validSkillFile);
      } catch {}
    }
  });
  it('should process a valid source file without errors', () => {
    // Create a temporary mock source file
    const mockSource = `
      export const skill = {
        name: "Test Skill",
        description: "A test skill for validation",
        categories: ["testing"],
        stats: {
          power: 10,
          cost: 5
        }
      };
    `;
    
    const tempFile = join(import.meta.dir, 'mock-skill.ts');
    writeFileSync(tempFile, mockSource);
    
    try {
      // Import and execute the generate function
      const { generateSkillsMarkdown } = await import('../../../../api/src/skills/generate-skills-md');
      expect(() => generateSkillsMarkdown([tempFile])).not.toThrow();
    } finally {
      // Cleanup
      try {
        unlinkSync(tempFile);
      } catch {}
    }
  });

  it('should handle multiple skill files correctly', async () => {
    // Create temporary mock skill files
    const mockSkill1 = `
      export const skill = {
        name: "Skill One",
        description: "First test skill",
        categories: ["category1"],
        stats: { power: 5, cost: 2 }
      };
    `;
    
    const mockSkill2 = `
      export const skill = {
        name: "Skill Two",
        description: "Second test skill",
        categories: ["category2"],
        stats: { power: 8, cost: 4 }
      };
    `;
    
    const tempFile1 = join(import.meta.dir, 'mock-skill1.ts');
    const tempFile2 = join(import.meta.dir, 'mock-skill2.ts');
    const outputFile = join(import.meta.dir, 'skills.md');
    
    writeFileSync(tempFile1, mockSkill1);
    writeFileSync(tempFile2, mockSkill2);
    
    try {
      const { generateSkillsMarkdown } = await import('../../../../api/src/skills/generate-skills-md');
      await generateSkillsMarkdown([tempFile1, tempFile2], outputFile);
      
      // Verify output file was created
      expect(existsSync(outputFile)).toBe(true);
      
      // Clean up output file
      if (existsSync(outputFile)) {
        unlinkSync(outputFile);
      }
    } finally {
      // Cleanup temp files
      try {
        unlinkSync(tempFile1);
        unlinkSync(tempFile2);
      } catch {}
    }
  });

  it('should handle invalid skill files gracefully', async () => {
    // Create a temporary invalid mock file
    const invalidMockSource = `
      export const notASkill = {
        name: "Not a Skill"
      };
    `;
    
    const tempFile = join(import.meta.dir, 'invalid-skill.ts');
    writeFileSync(tempFile, invalidMockSource);
    
    try {
      const { generateSkillsMarkdown } = await import('../../../../api/src/skills/generate-skills-md');
      expect(() => generateSkillsMarkdown([tempFile])).not.toThrow();
    } finally {
      // Cleanup
      try {
        unlinkSync(tempFile);
      } catch {}
    }
  });
});

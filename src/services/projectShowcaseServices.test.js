import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterProjectShowcase,
  getProjectTechnologyOptions,
  MAX_PROJECT_DESCRIPTION_LENGTH,
  normalizeProjectTechnologies,
  validateProjectSubmission
} from './projectShowcaseServices.js';

describe('project showcase validation', () => {
  it('normalizes a valid project submission', () => {
    const project = validateProjectSubmission({
      title: '  Portal   da turma ',
      description: 'Uma aplicação criada para organizar os materiais da nossa turma.  ',
      projectUrl: 'https://example.com/app',
      repositoryUrl: 'https://github.com/aluno/portal',
      technologies: 'JavaScript, CSS, javascript, Firebase'
    });

    assert.equal(project.title, 'Portal da turma');
    assert.equal(project.description, 'Uma aplicação criada para organizar os materiais da nossa turma.');
    assert.equal(project.projectUrl, 'https://example.com/app');
    assert.deepEqual(project.technologies, ['JavaScript', 'CSS', 'Firebase']);
  });

  it('requires a useful description, technology and at least one safe link', () => {
    assert.throws(() => validateProjectSubmission({
      title: 'Projeto', description: 'Curta', technologies: 'JavaScript', projectUrl: 'https://example.com'
    }), /descrição/);
    assert.throws(() => validateProjectSubmission({
      title: 'Projeto', description: 'Descrição suficientemente detalhada.', technologies: '', projectUrl: 'https://example.com'
    }), /tecnologia/);
    assert.throws(() => validateProjectSubmission({
      title: 'Projeto', description: 'Descrição suficientemente detalhada.', technologies: 'JavaScript'
    }), /link do projeto ou do repositório/);
    assert.throws(() => validateProjectSubmission({
      title: 'Projeto', description: 'Descrição suficientemente detalhada.', technologies: 'JavaScript', projectUrl: 'javascript:alert(1)'
    }), /http ou https/);
    assert.throws(() => validateProjectSubmission({
      title: 'Projeto', description: 'x'.repeat(MAX_PROJECT_DESCRIPTION_LENGTH + 1), technologies: 'JavaScript', projectUrl: 'https://example.com'
    }), /descrição/);
  });

  it('limits and deduplicates technologies', () => {
    assert.deepEqual(normalizeProjectTechnologies(['React', 'react', ' Node.js ']), ['React', 'Node.js']);
    assert.throws(() => normalizeProjectTechnologies(Array.from({ length: 9 }, (_, index) => `Tech ${index}`)), /no máximo 8/);
  });
});

describe('project showcase discovery', () => {
  const projects = [
    { id: '1', title: 'Portal Web', description: 'Projeto educacional', authorName: 'Ana', authorClassName: 'Entra21', technologies: ['React', 'Firebase'], active: true, deleted: false, createdAtMillis: 10 },
    { id: '2', title: 'API Escolar', description: 'Backend para alunos', authorName: 'Bruno', authorClassName: 'Jovem Programador', technologies: ['Node.js'], active: true, deleted: false, createdAtMillis: 20 },
    { id: '3', title: 'Arquivado', description: 'Não deve aparecer', authorName: 'Carlos', technologies: ['React'], active: false, deleted: true, createdAtMillis: 30 }
  ];

  it('searches text, filters technology and sorts projects', () => {
    assert.deepEqual(filterProjectShowcase(projects, { search: 'educacional' }).map(item => item.id), ['1']);
    assert.deepEqual(filterProjectShowcase(projects, { technology: 'React' }).map(item => item.id), ['1']);
    assert.deepEqual(filterProjectShowcase(projects).map(item => item.id), ['2', '1']);
    assert.deepEqual(filterProjectShowcase(projects, { sort: 'title' }).map(item => item.id), ['2', '1']);
  });

  it('builds technology options only from visible projects', () => {
    assert.deepEqual(getProjectTechnologyOptions(projects), ['Firebase', 'Node.js', 'React']);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ACADEMIC_CLASSES } from './academicServices.js';
import {
  filterCommunityPosts,
  MAX_COMMUNITY_POST_CONTENT_LENGTH,
  validateCommunityPost
} from './communityServices.js';

const subjects = [
  { id: 'web', name: 'Desenvolvimento Web', classId: 'entra21', className: 'Entra21', active: true },
  { id: 'english', name: 'Inglês', classId: 'jovemprogramador', className: 'Jovem Programador', active: true }
];

describe('community post validation', () => {
  it('normalizes content and links a post to its class and subject', () => {
    const post = validateCommunityPost({
      title: '  Novidades   da semana ',
      content: 'Primeiro aviso.  \n\nSegundo aviso.',
      url: 'https://developer.mozilla.org/docs/',
      classId: 'entra21',
      subjectId: 'web'
    }, DEFAULT_ACADEMIC_CLASSES, subjects);

    assert.equal(post.title, 'Novidades da semana');
    assert.equal(post.content, 'Primeiro aviso.\n\nSegundo aviso.');
    assert.equal(post.className, 'Entra21');
    assert.equal(post.subjectName, 'Desenvolvimento Web');
    assert.equal(post.url, 'https://developer.mozilla.org/docs/');
  });

  it('accepts a post without an external link', () => {
    const post = validateCommunityPost({
      title: 'Aviso importante',
      content: 'Conteúdo publicado pelo professor.',
      classId: 'entra21',
      subjectId: 'web'
    }, DEFAULT_ACADEMIC_CLASSES, subjects);
    assert.equal(post.url, '');
  });

  it('rejects invalid content, unsafe links and subjects from another class', () => {
    assert.throws(() => validateCommunityPost({
      title: 'Oi', content: 'Conteúdo', classId: 'entra21', subjectId: 'web'
    }, DEFAULT_ACADEMIC_CLASSES, subjects), /título/);
    assert.throws(() => validateCommunityPost({
      title: 'Post válido', content: 'x'.repeat(MAX_COMMUNITY_POST_CONTENT_LENGTH + 1), classId: 'entra21', subjectId: 'web'
    }, DEFAULT_ACADEMIC_CLASSES, subjects), /conteúdo/);
    assert.throws(() => validateCommunityPost({
      title: 'Post válido', content: 'Conteúdo válido', url: 'javascript:alert(1)', classId: 'entra21', subjectId: 'web'
    }, DEFAULT_ACADEMIC_CLASSES, subjects), /http ou https/);
    assert.throws(() => validateCommunityPost({
      title: 'Post válido', content: 'Conteúdo válido', classId: 'entra21', subjectId: 'english'
    }, DEFAULT_ACADEMIC_CLASSES, subjects), /não pertence à turma/);
  });
});

describe('community post filters', () => {
  const posts = [
    { id: '1', classId: 'entra21', subjectId: 'web', active: true, deleted: false },
    { id: '2', classId: 'entra21', subjectId: 'english', active: true, deleted: false },
    { id: '3', classId: 'jovemprogramador', subjectId: 'english', active: true, deleted: false },
    { id: '4', classId: 'entra21', subjectId: 'web', active: false, deleted: true }
  ];

  it('combines class and subject filters and hides archived posts', () => {
    assert.deepEqual(filterCommunityPosts(posts, { classId: 'entra21' }).map(post => post.id), ['1', '2']);
    assert.deepEqual(filterCommunityPosts(posts, { classId: 'entra21', subjectId: 'web' }).map(post => post.id), ['1']);
    assert.deepEqual(filterCommunityPosts(posts, { subjectId: 'english' }).map(post => post.id), ['2', '3']);
  });
});

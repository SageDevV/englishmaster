import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterNewsletterItems,
  inferNewsletterCategory,
  loadDeveloperNews,
  normalizeDevToArticle,
  normalizeStackOverflowQuestion
} from './newsletterServices.js';

describe('newsletter content normalization', () => {
  it('normalizes DEV articles and classifies developer topics', () => {
    const item = normalizeDevToArticle({
      id: 42,
      title: 'Building APIs with Node.js',
      description: 'A practical backend guide',
      url: 'https://dev.to/example',
      published_at: '2026-08-15T10:00:00Z',
      tag_list: ['javascript', 'node'],
      user: { name: 'Ada' },
      public_reactions_count: 12,
      comments_count: 3
    });
    assert.equal(item.sourceId, 'devto');
    assert.equal(item.category, 'Web');
    assert.equal(item.author, 'Ada');
    assert.equal(item.score, 12);
  });

  it('decodes Stack Overflow titles and maps answer counts as engagement', () => {
    const item = normalizeStackOverflowQuestion({
      question_id: 7,
      title: 'How to use A &amp; B in SQL?',
      link: 'https://stackoverflow.com/questions/7',
      creation_date: 1786788000,
      tags: ['sql'],
      score: 5,
      answer_count: 2,
      is_answered: true,
      owner: { display_name: 'Grace' }
    });
    assert.equal(item.title, 'How to use A & B in SQL?');
    assert.equal(item.category, 'Dados');
    assert.equal(item.comments, 2);
  });

  it('recognizes specialized categories', () => {
    assert.equal(inferNewsletterCategory({ title: 'Kubernetes on AWS' }), 'DevOps');
    assert.equal(inferNewsletterCategory({ tags: ['machine-learning'] }), 'IA');
    assert.equal(inferNewsletterCategory({ title: 'A language design note' }), 'Geral');
  });
});

describe('newsletter filtering and loading', () => {
  const items = [
    { id: 'a', title: 'React patterns', summary: '', author: 'A', tags: ['react'], sourceId: 'devto', category: 'Web', score: 3, comments: 1, publishedAt: '2026-08-15T10:00:00Z' },
    { id: 'b', title: 'Cloud security', summary: '', author: 'B', tags: ['security'], sourceId: 'hackernews', category: 'Segurança', score: 30, comments: 20, publishedAt: '2026-08-14T10:00:00Z' }
  ];

  it('combines search, source and category filters and supports popularity sorting', () => {
    assert.deepEqual(filterNewsletterItems(items, { search: 'react', source: 'devto' }).map(item => item.id), ['a']);
    assert.deepEqual(filterNewsletterItems(items, { category: 'Segurança' }).map(item => item.id), ['b']);
    assert.deepEqual(filterNewsletterItems(items, { sort: 'popular' }).map(item => item.id), ['b', 'a']);
  });

  it('keeps successful sources when another community is unavailable', async () => {
    const fetchImpl = async url => {
      if (url.includes('dev.to')) {
        return {
          ok: true,
          json: async () => [{
            id: 1,
            title: 'JavaScript update',
            description: 'News',
            url: 'https://dev.to/news',
            published_at: '2026-08-15T10:00:00Z',
            tag_list: ['javascript'],
            user: { name: 'Dev' }
          }]
        };
      }
      if (url.includes('algolia')) throw new Error('offline');
      return { ok: true, json: async () => ({ items: [] }) };
    };
    const result = await loadDeveloperNews({ fetchImpl, perSource: 1, timeoutMs: 100 });
    assert.equal(result.items.length, 1);
    assert.deepEqual(result.errors.map(error => error.sourceId), ['hackernews']);
  });
});

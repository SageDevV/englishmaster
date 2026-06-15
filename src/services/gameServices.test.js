import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSpeedrunQuestionQueue,
  formatElapsedTime,
  normalizeNicknameKey,
  validateNickname
} from './gameServices.js';

function createQuestion(answer) {
  return {
    question: `Question ${answer}`,
    options: [answer, 'wrong-a', 'wrong-b'],
    answer,
    difficulty: 'bronze'
  };
}

const stableRandom = () => 0.42;

describe('buildSpeedrunQuestionQueue', () => {
  it('selects exactly three unique questions per topic', () => {
    const topics = [
      { id: 'topic-a', title: 'Topic A' },
      { id: 'topic-b', title: 'Topic B' }
    ];
    const result = buildSpeedrunQuestionQueue({
      topics,
      topicQuestionMap: {
        'topic-a': ['a1', 'a2', 'a3', 'a4'].map(createQuestion),
        'topic-b': ['b1', 'b2', 'b3', 'b4'].map(createQuestion)
      },
      random: stableRandom
    });

    assert.equal(result.ok, true);
    assert.equal(result.questions.length, 6);
    assert.equal(new Set(result.questions.map(question => question.id)).size, 6);
    assert.equal(result.questions.filter(question => question.topicId === 'topic-a').length, 3);
    assert.equal(result.questions.filter(question => question.topicId === 'topic-b').length, 3);
    assert.ok(result.questions.every(question => question.optionOrder.length === question.options.length));
  });

  it('blocks start when a topic has fewer than three questions', () => {
    const result = buildSpeedrunQuestionQueue({
      topics: [{ id: 'topic-a', title: 'Topic A' }],
      topicQuestionMap: {
        'topic-a': ['a1', 'a2'].map(createQuestion)
      },
      random: stableRandom
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.missingTopics, [
      {
        id: 'topic-a',
        title: 'Topic A',
        available: 2,
        required: 3
      }
    ]);
  });
});

describe('nickname helpers', () => {
  it('normalizes nickname keys for uniqueness checks', () => {
    assert.equal(normalizeNicknameKey('  Joao  Silva  '), 'joao silva');
  });

  it('rejects empty and invalid nicknames', () => {
    assert.equal(validateNickname('  ').isValid, false);
    assert.equal(validateNickname('ab').isValid, false);
    assert.equal(validateNickname('bad@name').isValid, false);
  });

  it('accepts valid nicknames', () => {
    const result = validateNickname('Player_01');

    assert.equal(result.isValid, true);
    assert.equal(result.nickname, 'Player_01');
    assert.equal(result.nicknameKey, 'player_01');
  });
});

describe('formatElapsedTime', () => {
  it('formats seconds as mm:ss', () => {
    assert.equal(formatElapsedTime(0), '00:00');
    assert.equal(formatElapsedTime(9), '00:09');
    assert.equal(formatElapsedTime(75), '01:15');
  });
});

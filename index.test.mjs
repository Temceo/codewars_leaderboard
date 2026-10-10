import { getUserIds } from './index.mjs';

test('User count is correct', () => {
  expect(getUserIds().length).toBe(5);
});

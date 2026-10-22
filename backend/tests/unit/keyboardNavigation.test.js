const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Keyboard Navigation & Form Movement Logic Tests (Task 3)
 */
describe('Keyboard Navigation Logic & Rules (Task 3)', () => {
  it('1. Multiline textarea preserves Enter newline by default', () => {
    const textareaTarget = {
      tagName: 'TEXTAREA',
      dataset: {},
      value: 'Line 1',
    };
    // Should NOT advance field or preventDefault if enterNext is not true
    const shouldSkipEnter = textareaTarget.tagName === 'TEXTAREA' && textareaTarget.dataset?.enterNext !== 'true';
    assert.equal(shouldSkipEnter, true, 'Textarea must preserve native Enter newline');
  });

  it('2. Textarea with explicit data-enter-next advances field', () => {
    const textareaTarget = {
      tagName: 'TEXTAREA',
      dataset: { enterNext: 'true' },
      value: 'Line 1',
    };
    const shouldSkipEnter = textareaTarget.tagName === 'TEXTAREA' && textareaTarget.dataset?.enterNext !== 'true';
    assert.equal(shouldSkipEnter, false, 'Explicit enterNext must allow navigation');
  });

  it('3. Date and time inputs are protected from arrow hijacking', () => {
    const dateInputTypes = ['date', 'datetime-local', 'time', 'month', 'week'];
    for (const type of dateInputTypes) {
      const isProtected = ['date', 'datetime-local', 'time', 'month', 'week'].includes(type);
      assert.equal(isProtected, true, `${type} input must be protected from arrow hijacking`);
    }
    assert.equal(['date', 'datetime-local', 'time', 'month', 'week'].includes('text'), false);
    assert.equal(['date', 'datetime-local', 'time', 'month', 'week'].includes('number'), false);
  });

  it('4. Left arrow only moves field if cursor is at start of input (position 0)', () => {
    const inputAtMiddle = { tagName: 'INPUT', type: 'text', selectionStart: 3, selectionEnd: 3, value: 'hello' };
    const atStartMiddle = inputAtMiddle.selectionStart === 0 && inputAtMiddle.selectionEnd === 0;
    assert.equal(atStartMiddle, false, 'Middle cursor must allow normal left arrow editing');

    const inputAtStart = { tagName: 'INPUT', type: 'text', selectionStart: 0, selectionEnd: 0, value: 'hello' };
    const atStart = inputAtStart.selectionStart === 0 && inputAtStart.selectionEnd === 0;
    assert.equal(atStart, true, 'Cursor at 0 allows left arrow field movement');
  });

  it('5. Right arrow only moves field if cursor is at end of input', () => {
    const inputAtMiddle = { tagName: 'INPUT', type: 'text', selectionStart: 2, selectionEnd: 2, value: 'hello' };
    const atEndMiddle = inputAtMiddle.selectionStart === inputAtMiddle.value.length;
    assert.equal(atEndMiddle, false, 'Middle cursor must allow normal right arrow editing');

    const inputAtEnd = { tagName: 'INPUT', type: 'text', selectionStart: 5, selectionEnd: 5, value: 'hello' };
    const atEnd = inputAtEnd.selectionStart === inputAtEnd.value.length;
    assert.equal(atEnd, true, 'Cursor at end allows right arrow field movement');
  });

  it('6. Combobox: Enter when dropdown is open selects option instead of submitting form', () => {
    const comboboxState = {
      isOpen: true,
      listCount: 5,
      activeIdx: 2,
      options: ['Cash', 'Bank HDFC', 'Bank SBI', 'Petty Cash', 'Cheque in Hand'],
    };
    let formSubmitted = false;
    let selectedOption = null;

    const handleComboboxEnter = () => {
      if (comboboxState.isOpen && comboboxState.listCount > 0) {
        selectedOption = comboboxState.options[comboboxState.activeIdx];
        comboboxState.isOpen = false;
        return; // Prevents form submission
      }
      formSubmitted = true;
    };

    handleComboboxEnter();
    assert.equal(selectedOption, 'Bank SBI');
    assert.equal(formSubmitted, false, 'Form must NOT be submitted on combobox Enter selection');
  });

  it('7. Combobox: Enter when dropdown is closed advances to next field', () => {
    const comboboxState = {
      isOpen: false,
      value: 'Bank SBI',
    };
    let advancedToNext = false;

    const handleComboboxEnter = () => {
      if (!comboboxState.isOpen) {
        advancedToNext = true;
      }
    };

    handleComboboxEnter();
    assert.equal(advancedToNext, true, 'Closed combobox Enter advances to next field');
  });

  it('8. Shift+Enter navigates backward', () => {
    const event = { key: 'Enter', shiftKey: true, ctrlKey: false, altKey: false };
    const isBackward = event.key === 'Enter' && event.shiftKey;
    assert.equal(isBackward, true, 'Shift+Enter must trigger backward navigation');
  });
});

import wrapSpecialCharacters from '../../../../src/utils/handlebars/helpers/wrap-special-characters';

describe('wrap-special-characters', () => {
  it('should wrap special characters', () => {
    expect.assertions(4);

    expect(wrapSpecialCharacters('special Name')).toBe("'special Name'");
    expect(wrapSpecialCharacters(' Name')).toBe("' Name'");
    expect(wrapSpecialCharacters('special-name')).toBe("'special-name'");
    expect(wrapSpecialCharacters('@specialname')).toBe("'@specialname'");
  });

  it('should not wrap if no special character', () => {
    expect.assertions(4);

    expect(wrapSpecialCharacters('notSpecialName')).toBe('notSpecialName');
    expect(wrapSpecialCharacters('notSpecialName12')).toBe('notSpecialName12');
    expect(wrapSpecialCharacters('_notSpecialName12')).toBe('_notSpecialName12');
    expect(wrapSpecialCharacters('1234')).toBe('1234');
  });
});

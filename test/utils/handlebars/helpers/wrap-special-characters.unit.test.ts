import wrapSpecialCharacters from '../../../../src/utils/handlebars/helpers/wrap-special-characters';

describe('helpers > wrap-special-characters', () => {
  it('should wrap special characters', () => {
    expect.assertions(7);

    expect(wrapSpecialCharacters('special Name')).toBe("'special Name'");
    expect(wrapSpecialCharacters(' Name')).toBe("' Name'");
    expect(wrapSpecialCharacters('special-name')).toBe("'special-name'");
    expect(wrapSpecialCharacters('@specialname')).toBe("'@specialname'");
    expect(wrapSpecialCharacters('3national')).toBe("'3national'");
    expect(wrapSpecialCharacters('random*')).toBe("'random*'");
    expect(wrapSpecialCharacters('random:random')).toBe("'random:random'");
  });

  it('should not wrap if no special character', () => {
    expect.assertions(4);

    expect(wrapSpecialCharacters('notSpecialName')).toBe('notSpecialName');
    expect(wrapSpecialCharacters('notSpecialName12')).toBe('notSpecialName12');
    expect(wrapSpecialCharacters('_notSpecialName12')).toBe('_notSpecialName12');
    expect(wrapSpecialCharacters('notConsideredAsSpecial1234')).toBe('notConsideredAsSpecial1234');
  });
});

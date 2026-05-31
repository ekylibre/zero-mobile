import { render, fireEvent } from '@testing-library/react-native';

import { InlineAddButton } from '../InlineAddButton';

describe('InlineAddButton', () => {
  it('rend le libellé', () => {
    const { getByText } = render(<InlineAddButton label="+ AJOUTER" onPress={() => {}} />);
    expect(getByText('+ AJOUTER')).toBeTruthy();
  });

  it('appelle onPress au tap', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <InlineAddButton label="+ AJOUTER" onPress={onPress} testID="add" />,
    );
    fireEvent.press(getByTestId('add'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

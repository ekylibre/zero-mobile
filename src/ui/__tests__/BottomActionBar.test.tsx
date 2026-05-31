import { render, fireEvent } from '@testing-library/react-native';

import { BottomActionBar } from '../BottomActionBar';

describe('BottomActionBar', () => {
  it('rend le bouton primaire et déclenche onPress', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <BottomActionBar primary={{ label: 'Enregistrer', onPress, testID: 'save' }} />,
    );
    fireEvent.press(getByTestId('save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('rend le bouton secondaire quand fourni', () => {
    const onSecondary = jest.fn();
    const { getByTestId } = render(
      <BottomActionBar
        primary={{ label: 'Enregistrer', onPress: () => {}, testID: 'save' }}
        secondary={{ label: 'Annuler', onPress: onSecondary, testID: 'cancel' }}
      />,
    );
    fireEvent.press(getByTestId('cancel'));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('ne déclenche pas onPress quand désactivé', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <BottomActionBar
        primary={{ label: 'Enregistrer', onPress, disabled: true, testID: 'save' }}
      />,
    );
    fireEvent.press(getByTestId('save'));
    expect(onPress).not.toHaveBeenCalled();
  });
});

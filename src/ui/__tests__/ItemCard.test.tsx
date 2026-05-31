import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ItemCard } from '../ItemCard';

describe('ItemCard', () => {
  it('rend titre et sous-titre', () => {
    const { getByText } = render(<ItemCard title="PRIAXOR EC" subtitle="Basf Agro SAS" />);
    expect(getByText('PRIAXOR EC')).toBeTruthy();
    expect(getByText('Basf Agro SAS')).toBeTruthy();
  });

  it('n’affiche la croix de suppression que si onRemove est fourni', () => {
    const { queryByTestId, rerender } = render(<ItemCard title="Sans suppression" testID="card" />);
    expect(queryByTestId('card-remove')).toBeNull();

    rerender(<ItemCard title="Avec suppression" onRemove={() => {}} testID="card" />);
    expect(queryByTestId('card-remove')).toBeTruthy();
  });

  it('appelle onRemove au tap sur la croix', () => {
    const onRemove = jest.fn();
    const { getByTestId } = render(<ItemCard title="X" onRemove={onRemove} testID="card" />);
    fireEvent.press(getByTestId('card-remove'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('rend le contenu enfant', () => {
    const { getByText } = render(
      <ItemCard title="X">
        <Text>ligne quantité</Text>
      </ItemCard>,
    );
    expect(getByText('ligne quantité')).toBeTruthy();
  });
});

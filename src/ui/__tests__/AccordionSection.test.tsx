import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AccordionSection } from '../AccordionSection';

describe('AccordionSection', () => {
  it('affiche le contenu uniquement lorsque déplié', () => {
    const { queryByText, rerender } = render(
      <AccordionSection title="Cibles" expanded={false} onToggle={() => {}}>
        <Text>contenu</Text>
      </AccordionSection>,
    );
    expect(queryByText('contenu')).toBeNull();

    rerender(
      <AccordionSection title="Cibles" expanded onToggle={() => {}}>
        <Text>contenu</Text>
      </AccordionSection>,
    );
    expect(queryByText('contenu')).toBeTruthy();
  });

  it('affiche le résumé string même replié', () => {
    const { getByText } = render(
      <AccordionSection
        title="Cibles"
        summary="2 cultures • 4,3 ha"
        expanded={false}
        onToggle={() => {}}
      >
        <Text>contenu</Text>
      </AccordionSection>,
    );
    expect(getByText('2 cultures • 4,3 ha')).toBeTruthy();
  });

  it('appelle onToggle au tap sur l’en-tête', () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <AccordionSection title="Cibles" expanded={false} onToggle={onToggle} testID="sec">
        <Text>contenu</Text>
      </AccordionSection>,
    );
    fireEvent.press(getByTestId('sec-header'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

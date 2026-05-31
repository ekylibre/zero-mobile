import { render } from '@testing-library/react-native';

import { ProcedureIcon } from '../ProcedureIcon';

describe('ProcedureIcon', () => {
  it('rend le glyphe (pas l’initiale) pour une procédure mappée', () => {
    // Pour une procédure connue, on n'affiche PAS le fallback initiale.
    // (On évite de matcher l'emoji directement : fragile entre fichiers.)
    const { queryByText } = render(<ProcedureIcon procedureName="spraying" />);
    expect(queryByText('S')).toBeNull();
  });

  it('retombe sur l’initiale majuscule pour une procédure inconnue', () => {
    const { getByText } = render(<ProcedureIcon procedureName="zarbi" />);
    expect(getByText('Z')).toBeTruthy();
  });

  it('expose le testID fourni', () => {
    const { getByTestId } = render(<ProcedureIcon procedureName="spraying" testID="proc-icon" />);
    expect(getByTestId('proc-icon')).toBeTruthy();
  });
});

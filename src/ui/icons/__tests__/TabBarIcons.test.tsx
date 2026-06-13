import { render } from '@testing-library/react-native';

import { CogIcon, LandParcelIcon, TractorIcon } from '../TabBarIcons';

describe('TabBarIcons', () => {
  it('rend les 3 icônes sans crasher', () => {
    expect(() => render(<TractorIcon size={24} color="#000" />)).not.toThrow();
    expect(() => render(<LandParcelIcon size={24} color="#000" />)).not.toThrow();
    expect(() => render(<CogIcon size={24} color="#000" />)).not.toThrow();
  });
});

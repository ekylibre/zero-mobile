import { parseParcelSvg } from '../ParcelShape';

describe('parseParcelSvg', () => {
  const SVG =
    "<svg width='180' height='180' viewBox='-0.748053 -45.845142 0.006866 0.003895' " +
    "xmlns='http://www.w3.org/2000/svg'><path d='M-0.74251,-45.842176L-0.742775,-45.842323Z'/></svg>";

  it('extrait le viewBox et le `d` du premier path (attributs en guillemets simples)', () => {
    expect(parseParcelSvg(SVG)).toEqual({
      viewBox: '-0.748053 -45.845142 0.006866 0.003895',
      d: 'M-0.74251,-45.842176L-0.742775,-45.842323Z',
    });
  });

  it('gère les guillemets doubles', () => {
    const svg = '<svg viewBox="0 0 10 10"><path d="M0,0L10,10"/></svg>';
    expect(parseParcelSvg(svg)).toEqual({ viewBox: '0 0 10 10', d: 'M0,0L10,10' });
  });

  it('renvoie null si viewBox ou path absent', () => {
    expect(parseParcelSvg('<svg><rect /></svg>')).toBeNull();
    expect(parseParcelSvg("<svg viewBox='0 0 1 1'></svg>")).toBeNull();
    expect(parseParcelSvg('pas du svg')).toBeNull();
  });
});

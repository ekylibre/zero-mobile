import { buildProviderTag, type DeviceInfo } from '../provider-tag';

const DEVICE: DeviceInfo = {
  appVersion: '0.1.0',
  os: 'ios',
  locale: 'fr-FR',
};

describe('buildProviderTag', () => {
  it('produit un tag avec vendor/name fixes et id = clientUuid', () => {
    const tag = buildProviderTag('uuid-1', DEVICE);

    expect(tag).toMatchObject({
      vendor: 'ekylibre-mobile',
      name: 'zero-mobile',
      id: 'uuid-1',
    });
  });

  it('ré-expose appVersion / os / locale dans data', () => {
    const tag = buildProviderTag('u', DEVICE);
    expect(tag.data).toMatchObject({
      app_version: '0.1.0',
      os: 'ios',
      locale: 'fr-FR',
    });
  });

  it('inclut device_model uniquement quand fourni', () => {
    const without = buildProviderTag('u', DEVICE);
    expect(without.data.device_model).toBeUndefined();

    const withModel = buildProviderTag('u', { ...DEVICE, deviceModel: 'iPhone15,2' });
    expect(withModel.data.device_model).toBe('iPhone15,2');
  });

  it('supporte tous les os déclarés (ios, android, web)', () => {
    expect(buildProviderTag('u', { ...DEVICE, os: 'android' }).data.os).toBe('android');
    expect(buildProviderTag('u', { ...DEVICE, os: 'web' }).data.os).toBe('web');
  });
});

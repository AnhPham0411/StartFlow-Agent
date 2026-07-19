import { TestBed } from '@angular/core/testing';
import { AuthStateService } from '../core/auth/auth-state.service';
import { LayoutConfiguration } from './layout.configuration';

describe('LayoutConfiguration', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LayoutConfiguration,
        {
          provide: AuthStateService,
          useValue: {
            user: () => ({ username: 'admin', name: 'SHB Admin' }),
            logout: () => Promise.resolve(),
          },
        },
      ],
    });
  });

  it('uses the supplied SHB logo and palette', () => {
    const configuration = TestBed.inject(LayoutConfiguration);

    expect(configuration.sidebar as unknown).toEqual({
      version: 1,
      brandColor: '#f37021',
      brandLightColor: '#fff3e8',
      logoUrl: '/logo.png',
      defaultTitle: 'SHB StartFlow',
      pin: { enabled: true },
    });
  });
});

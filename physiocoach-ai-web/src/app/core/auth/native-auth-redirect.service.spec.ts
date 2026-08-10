import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NativeAuthRedirectService } from './native-auth-redirect.service';
import { AuthService } from './auth.service';

const capacitorMock = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
}));

const appMock = vi.hoisted(() => ({
  addListener: vi.fn(),
}));

const browserMock = vi.hoisted(() => ({
  close: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitorMock,
}));

vi.mock('@capacitor/app', () => ({
  App: appMock,
}));

vi.mock('@capacitor/browser', () => ({
  Browser: browserMock,
}));

describe('NativeAuthRedirectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitorMock.isNativePlatform.mockReturnValue(true);
    appMock.addListener.mockResolvedValue({ remove: vi.fn() });
    browserMock.close.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        NativeAuthRedirectService,
        {
          provide: AuthService,
          useValue: {
            completeNativeRedirect: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });
  });

  it('completes auth when a native OAuth redirect returns to the app scheme', async () => {
    const service = TestBed.inject(NativeAuthRedirectService);
    const auth = TestBed.inject(AuthService);

    service.start();

    expect(appMock.addListener).toHaveBeenCalledWith('appUrlOpen', expect.any(Function));
    const [, handler] = appMock.addListener.mock.calls[0];

    handler({ url: 'ir.otconnect.physiocoach://oauth-callback?code=code_123' });

    await vi.waitFor(() => {
      expect(browserMock.close).toHaveBeenCalled();
      expect(auth.completeNativeRedirect).toHaveBeenCalledWith(
        'ir.otconnect.physiocoach://oauth-callback?code=code_123',
      );
    });
  });

  it('completes auth when redirect URL uses a single-slash fallback scheme', async () => {
    const service = TestBed.inject(NativeAuthRedirectService);
    const auth = TestBed.inject(AuthService);

    service.start();

    const [, handler] = appMock.addListener.mock.calls[0];
    handler({ url: 'ir.otconnect.physiocoach:/oauth-callback?code=code_456' });

    await vi.waitFor(() => {
      expect(browserMock.close).toHaveBeenCalled();
      expect(auth.completeNativeRedirect).toHaveBeenCalledWith(
        'ir.otconnect.physiocoach:/oauth-callback?code=code_456',
      );
    });
  });

  it('completes auth when redirect URL uses HTTPS Cloudflare Pages dev App Link', async () => {
    const service = TestBed.inject(NativeAuthRedirectService);
    const auth = TestBed.inject(AuthService);

    service.start();

    const [, handler] = appMock.addListener.mock.calls[0];
    handler({ url: 'https://dev.physiocoach-ai-web.pages.dev/oauth-callback?code=code_789' });

    await vi.waitFor(() => {
      expect(browserMock.close).toHaveBeenCalled();
      expect(auth.completeNativeRedirect).toHaveBeenCalledWith(
        'https://dev.physiocoach-ai-web.pages.dev/oauth-callback?code=code_789',
      );
    });
  });

  it('completes auth when redirect URL uses custom production domain App Link', async () => {
    const service = TestBed.inject(NativeAuthRedirectService);
    const auth = TestBed.inject(AuthService);

    service.start();

    const [, handler] = appMock.addListener.mock.calls[0];
    handler({ url: 'https://physiocoach.otconnect.ir/oauth-callback?code=code_abc' });

    await vi.waitFor(() => {
      expect(browserMock.close).toHaveBeenCalled();
      expect(auth.completeNativeRedirect).toHaveBeenCalledWith(
        'https://physiocoach.otconnect.ir/oauth-callback?code=code_abc',
      );
    });
  });

  it('ignores unknown Cloudflare Pages preview redirect hosts', async () => {
    const service = TestBed.inject(NativeAuthRedirectService);
    const auth = TestBed.inject(AuthService);

    service.start();

    const [, handler] = appMock.addListener.mock.calls[0];
    handler({ url: 'https://preview.physiocoach-ai-web.pages.dev/oauth-callback?code=code_def' });

    await Promise.resolve();

    expect(browserMock.close).not.toHaveBeenCalled();
    expect(auth.completeNativeRedirect).not.toHaveBeenCalled();
  });

  it('does not register URL handling in web builds', () => {
    capacitorMock.isNativePlatform.mockReturnValue(false);

    const service = TestBed.inject(NativeAuthRedirectService);
    service.start();

    expect(appMock.addListener).not.toHaveBeenCalled();
  });
});

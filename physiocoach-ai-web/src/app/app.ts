import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('physiocoach-ai-web');
  private readonly themeService = inject(ThemeService);

  constructor() {
    this.themeService.applyTheme(this.themeService.readStoredTheme() ?? 'system', false);
  }
}

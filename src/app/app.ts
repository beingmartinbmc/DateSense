import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AnalyticsService } from './services/analytics.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private analytics = inject(AnalyticsService);

  ngOnInit(): void {
    // Root-level init so EVERY entry point is measured. Doing this per-page
    // meant visitors landing straight on a shared verdict (/#/r/:token) were
    // never counted — which is exactly the traffic the viral loop produces.
    this.analytics.init();
  }
}

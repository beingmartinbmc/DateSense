import { Component, signal, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ScoreCard } from '../../components/score-card/score-card';
import { ReplyList } from '../../components/reply-list/reply-list';
import { DateIdeas } from '../../components/date-ideas/date-ideas';
import { ShareCard } from '../../components/share-card/share-card';
import { AnalysisResponse } from '../../services/api.service';
import { ResultStore } from '../../services/result-store.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, ScoreCard, ReplyList, DateIdeas, ShareCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  result = signal<AnalysisResponse | null>(null);
  imageUrls = signal<string[]>([]);
  /** True when viewing someone else's shared link (limited, read-only verdict). */
  isSharedView = signal(false);

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private store = inject(ResultStore);

  ngOnInit(): void {
    // 1. Shared link: /r/:token — decode a verdict someone shared with us.
    const token = this.route.snapshot.paramMap.get('token');
    if (token) {
      const decoded = this.store.decodeShareToken(token);
      if (decoded) {
        this.result.set(decoded);
        this.isSharedView.set(true);
        return;
      }
      this.router.navigate(['/']);
      return;
    }

    // 2. Fresh navigation state from an analysis run.
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state || history.state;
    if (state?.result) {
      this.result.set(state.result);
      this.imageUrls.set(state.imageUrls || (state.imageUrl ? [state.imageUrl] : []));
      this.store.set(state.result, this.imageUrls());
      return;
    }

    // 3. Refresh fallback: restore the last result from session storage.
    if (this.store.restore()) {
      const restored = this.store.result();
      if (restored) {
        this.result.set(restored);
        this.imageUrls.set(this.store.imageUrls());
        return;
      }
    }

    // 4. Nothing to show.
    this.router.navigate(['/']);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}

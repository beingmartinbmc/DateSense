import { Component, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ScoreCard } from '../../components/score-card/score-card';
import { ReplyList } from '../../components/reply-list/reply-list';
import { DateIdeas } from '../../components/date-ideas/date-ideas';
import { AnalysisResponse } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, ScoreCard, ReplyList, DateIdeas],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  result = signal<AnalysisResponse | null>(null);
  imageUrls = signal<string[]>([]);

  constructor(private router: Router) {}

  ngOnInit(): void {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state || history.state;

    if (state?.result) {
      this.result.set(state.result);
      this.imageUrls.set(state.imageUrls || (state.imageUrl ? [state.imageUrl] : []));
    } else {
      this.router.navigate(['/']);
    }
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}

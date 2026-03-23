import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';

export interface ManualInputData {
  yourName: string;
  theirName: string;
  yourAge: string;
  theirAge: string;
  platform: string;
  chatDuration: string;
  chatMessages: string;
  yourBio: string;
  theirBio: string;
  additionalContext: string;
}

@Component({
  selector: 'app-manual-input',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule],
  templateUrl: './manual-input.html',
  styleUrl: './manual-input.css',
})
export class ManualInput {
  submitted = output<ManualInputData>();

  yourName = signal('');
  theirName = signal('');
  yourAge = signal('');
  theirAge = signal('');
  platform = signal('');
  chatDuration = signal('');
  chatMessages = signal('');
  yourBio = signal('');
  theirBio = signal('');
  additionalContext = signal('');

  platforms = ['Tinder', 'Bumble', 'Hinge', 'Instagram', 'WhatsApp', 'iMessage', 'Other'];

  readonly maxMessageLength = 10000;
  readonly maxFieldLength = 200;
  validationError = signal('');

  get isValid(): boolean {
    const messages = this.chatMessages().trim();
    if (messages.length === 0) {
      this.validationError.set('Chat messages are required.');
      return false;
    }
    if (messages.length > this.maxMessageLength) {
      this.validationError.set(`Chat messages must be under ${this.maxMessageLength} characters.`);
      return false;
    }
    if (this.yourName().length > this.maxFieldLength ||
        this.theirName().length > this.maxFieldLength ||
        this.yourBio().length > 1000 ||
        this.theirBio().length > 1000 ||
        this.additionalContext().length > 1000) {
      this.validationError.set('One or more fields exceed the maximum length.');
      return false;
    }
    this.validationError.set('');
    return true;
  }

  onSubmit(): void {
    if (!this.isValid) return;
    this.submitted.emit({
      yourName: this.yourName(),
      theirName: this.theirName(),
      yourAge: this.yourAge(),
      theirAge: this.theirAge(),
      platform: this.platform(),
      chatDuration: this.chatDuration(),
      chatMessages: this.chatMessages(),
      yourBio: this.yourBio(),
      theirBio: this.theirBio(),
      additionalContext: this.additionalContext(),
    });
  }
}

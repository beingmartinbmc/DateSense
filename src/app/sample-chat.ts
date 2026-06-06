import { ManualInputData } from './services/api.service';

/**
 * A built-in demo conversation so first-time visitors can experience the full
 * analysis instantly — no screenshot, no typing, zero friction. This is the
 * single biggest lever for top-of-funnel activation.
 */
export const SAMPLE_CHAT: ManualInputData = {
  yourName: 'You',
  theirName: 'Alex',
  yourAge: '27',
  theirAge: '26',
  platform: 'Hinge',
  chatDuration: '4 days',
  yourBio: 'Coffee snob, weekend hiker, terrible at mini golf but enthusiastic.',
  theirBio: 'Dog mom, true-crime addict, will judge your playlist.',
  additionalContext: 'We matched a few days ago. Replies have been slowing down a little.',
  chatMessages: `You: ok your bio says you'll judge my playlist so I have to know — what's the most embarrassing song on yours?
Alex: haha bold of you to assume I'd admit it
Alex: ...fine. there's an unreasonable amount of early 2010s pop on there
You: that's not embarrassing that's elite taste actually
You: top 3 desert island songs, go
Alex: oof putting me on the spot
Alex: lol idk i'd have to think about it
You: take your time, this is a very serious interview
Alex: haha
You: so the true-crime thing — are you the type who solves it before the episode ends or the type who gets too scared to sleep
Alex: little of both honestly
You: respectable. there's a great true crime themed trivia night at the pub on 5th btw, could be fun
Alex: oh nice maybe!`,
};

// ONE challenge spec. Every challenge string in the protocol is built
// here — website, server, docs. External miners: replicate EXACTLY:
//   prefixed: `v3-round:<round>:<user_id>:<salt>` (salt may be "")
//   bare:     `<round>:<user_id>:<salt>`
// Both shapes verify. The salt must be fresh random per attempt.

export function buildChallenge(input: {
  round: number;
  userId: string;
  salt?: string;
  prefixed?: boolean;
}): string {
  const salt = input.salt ?? "";
  const body = `${input.round}:${input.userId}:${salt}`;
  return input.prefixed === false ? body : `v3-round:${body}`;
}

export function candidateChallenges(input: { round: number; userId: string; salt?: string }): string[] {
  const full = buildChallenge({ ...input, prefixed: true });
  const bare = buildChallenge({ ...input, prefixed: false });
  return full === bare ? [full] : [full, bare];
}

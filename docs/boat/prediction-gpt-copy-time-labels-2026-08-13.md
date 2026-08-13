# Prediction GPT Copy Time Labels

## Time Classification

The GPT copy classifies a venue from its event name and the first and latest closing times. A venue is `midnight` when the title contains `ミッドナイト`, the latest closing time is 21:00 or later, or the venue starts at 17:00 or later and ends at 21:00 or later. Morning venues start before 10:30, night venues start at 17:00 or later, and all remaining venues are day venues.

Each race uses its own closing time. Midnight venues remain midnight for every race. Other races are morning before 10:30, day before 17:00, night before 21:00, and midnight from 21:00 onward. The range purpose label is derived from that venue classification, so a midnight 1R to 6R copy is never labelled morning or day.

## Betting Contract

Both bulk copy ranges include the same GPT instruction: ten three-trifecta selections, split into two primary, three main, three medium long-shot, and two large long-shot selections. Two-exacta is not used. The copy explicitly prioritizes race development over odds and treats missing exhibition information as a pre-race prediction state.

## EX Availability

When a current-date EX race-analysis shard cannot be matched, the copy states that the current-date EX analysis is unavailable and shows only the historical aggregate availability. EX racer information remains limited to source-backed identity linkage.

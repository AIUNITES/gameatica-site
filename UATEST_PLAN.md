# Gameatica - UA Test Plan

## Site Information
| Field | Value |
|-------|-------|
| **Site Name** | Gameatica |
| **Repository** | gameatica-site |
| **Live URL** | https://aiunites.github.io/gameatica-site/ |
| **Local Path** | C:/Users/Tom/Documents/GitHub/gameatica-site |
| **Last Updated** | January 25, 2026 |
| **Version** | 2.0.0 |
| **Based On** | Custom Arcade |

---

## Pages Inventory

| Page | File | Description | Status |
|------|------|-------------|--------|
| Arcade Hub | index.html | Main game selection page | ✅ |
| Snake | games/snake.html | Classic snake game | ✅ |
| Tetris | games/tetris.html | Block stacking puzzle | ✅ |
| 2048 | games/2048.html | Number sliding puzzle | ✅ |
| Memory Match | games/memory.html | Card matching game | ✅ |
| Breakout | games/breakout.html | Brick breaking game | ✅ |
| Minesweeper | games/minesweeper.html | Mine clearing puzzle | ✅ |
| Trivia Quiz | games/trivia.html | Knowledge quiz game | ✅ |
| Typing Test | games/typing.html | WPM speed test | ✅ |
| Reaction Test | games/reaction.html | Reflex testing | ✅ |
| Word Guess | games/wordguess.html | Wordle-style game | ✅ |
| Flappy | games/flappy.html | Flying obstacle game | ✅ |
| Pong | games/pong.html | Classic paddle game | ✅ |
| Simon Says | games/simon.html | Memory pattern game | ✅ |
| Asteroids | games/asteroids.html | Space shooter | ✅ |
| Blackjack | games/blackjack.html | Card game vs dealer | ✅ |
| Match 3 | games/match3.html | Gem matching | ✅ |
| Sliding Puzzle | games/sliding.html | Tile slider | ✅ |
| Sudoku | games/sudoku.html | Number logic puzzle | ✅ |

---

## Core Features

### 🎮 Arcade Hub (index.html)
| Feature | Status | Notes |
|---------|--------|-------|
| Game grid display | ✅ | 18 games with icons |
| Category filters | ✅ | All/Arcade/Puzzle/Skill/Word |
| Player name system | ✅ | Stored in localStorage |
| Play count stats | ✅ | Tracks total plays |
| AIUNITES Webring | ✅ | Top navigation bar |
| Responsive design | ✅ | Mobile-friendly grid |

### 🎯 Shared Game Features
| Feature | Status | Notes |
|---------|--------|-------|
| Local high scores | ✅ | Per-game leaderboards |
| Personal best tracking | ✅ | Shows on game page |
| Game over modal | ✅ | Score, restart, back to arcade |
| Mobile controls | ✅ | Touch, swipe, D-pad buttons |
| Keyboard controls | ✅ | Arrow keys, WASD |
| Sound effects | ✅ | Web Audio API beeps |
| Haptic feedback | ✅ | Vibrate on mobile |
| CloudDB sync | ✅ | Optional score cloud backup |

---

## Games Detail

### 🐍 Snake
| Feature | Status |
|---------|--------|
| Grid-based movement | ✅ |
| Food spawning | ✅ |
| Collision detection (walls/self) | ✅ |
| Score & level system | ✅ |
| Speed increases with level | ✅ |
| Pause functionality | ✅ |
| Mobile D-pad controls | ✅ |
| Swipe controls | ✅ |

### 🧱 Tetris
| Feature | Status |
|---------|--------|
| 7 tetromino pieces | ✅ |
| Rotation system | ✅ |
| Line clearing | ✅ |
| Ghost piece preview | ✅ |
| Next piece display | ✅ |
| Hard drop (space) | ✅ |
| Level progression | ✅ |

### 🔢 2048
| Feature | Status |
|---------|--------|
| 4x4 grid | ✅ |
| Tile merging | ✅ |
| Swipe controls | ✅ |
| Score tracking | ✅ |
| Win detection (2048) | ✅ |
| Continue after win | ✅ |
| Game over detection | ✅ |

### 🧠 Memory Match
| Feature | Status |
|---------|--------|
| 4x4 easy mode | ✅ |
| 6x6 hard mode | ✅ |
| Card flip animation | ✅ |
| Match detection | ✅ |
| Move counter | ✅ |
| Timer | ✅ |
| Score based on speed | ✅ |

### 🏓 Breakout
| Feature | Status |
|---------|--------|
| Paddle movement | ✅ |
| Ball physics | ✅ |
| Brick collision | ✅ |
| Lives system | ✅ |
| Level progression | ✅ |
| Paddle shrinks per level | ✅ |
| Colored bricks (points) | ✅ |

### 💣 Minesweeper
| Feature | Status |
|---------|--------|
| Easy (9x9, 10 mines) | ✅ |
| Medium (16x16, 40 mines) | ✅ |
| Hard (16x30, 99 mines) | ✅ |
| Flag mode toggle | ✅ |
| Right-click flagging | ✅ |
| Auto-reveal empty cells | ✅ |
| Win/lose detection | ✅ |
| Timer | ✅ |

### 🧩 Trivia Quiz
| Feature | Status |
|---------|--------|
| Science category | ✅ |
| History category | ✅ |
| Geography category | ✅ |
| Entertainment category | ✅ |
| Timer per question | ✅ |
| Streak bonus | ✅ |
| 10 questions per game | ✅ |

### ⌨️ Typing Test
| Feature | Status |
|---------|--------|
| 30 second mode | ✅ |
| 60 second mode | ✅ |
| 2 minute mode | ✅ |
| WPM calculation | ✅ |
| Accuracy tracking | ✅ |
| Character highlighting | ✅ |
| Multiple text samples | ✅ |

### ⚡ Reaction Test
| Feature | Status |
|---------|--------|
| 5 attempts per game | ✅ |
| Random delay (1-4s) | ✅ |
| Too early detection | ✅ |
| Best/average times | ✅ |
| Result chips display | ✅ |

### 📝 Word Guess
| Feature | Status |
|---------|--------|
| 5-letter words | ✅ |
| 6 guesses | ✅ |
| Green/yellow/gray hints | ✅ |
| On-screen keyboard | ✅ |
| Physical keyboard support | ✅ |
| Stats tracking | ✅ |

### 🐦 Flappy
| Feature | Status |
|---------|--------|
| Tap to fly | ✅ |
| Pipe generation | ✅ |
| Collision detection | ✅ |
| Score counting | ✅ |
| Bird rotation animation | ✅ |

### 🏓 Pong
| Feature | Status |
|---------|--------|
| Player vs CPU | ✅ |
| Mouse/touch paddle control | ✅ |
| Ball physics | ✅ |
| Score to 5 wins | ✅ |
| Rally counting | ✅ |
| CPU difficulty scales | ✅ |

### 🎨 Simon Says
| Feature | Status |
|---------|--------|
| 4 color buttons | ✅ |
| Audio tones per color | ✅ |
| Sequence playback | ✅ |
| Player input tracking | ✅ |
| Round progression | ✅ |
| Speed increases | ✅ |

### ☄️ Asteroids
| Feature | Status |
|---------|--------|
| Ship controls | ✅ |
| Asteroid spawning | ✅ |
| Bullet shooting | ✅ |
| Wrap-around screen | ✅ |
| Score tracking | ✅ |
| Lives system | ✅ |

### 🃏 Blackjack
| Feature | Status |
|---------|--------|
| Card deck | ✅ |
| Hit action | ✅ |
| Stand action | ✅ |
| Double down | ✅ |
| Dealer AI | ✅ |
| Chip betting | ✅ |

### 💎 Match 3
| Feature | Status |
|---------|--------|
| Grid of gems | ✅ |
| Swap mechanic | ✅ |
| Match detection | ✅ |
| Cascade system | ✅ |
| Score tracking | ✅ |
| Timer/moves modes | ✅ |

### 🧩 Sliding Puzzle
| Feature | Status |
|---------|--------|
| 3x3 grid mode | ✅ |
| 4x4 grid mode | ✅ |
| Tile sliding | ✅ |
| Shuffle function | ✅ |
| Move counter | ✅ |
| Win detection | ✅ |

### 9️⃣ Sudoku
| Feature | Status |
|---------|--------|
| Easy difficulty | ✅ |
| Medium difficulty | ✅ |
| Hard difficulty | ✅ |
| Number input | ✅ |
| Conflict highlighting | ✅ |
| Timer | ✅ |

---

## localStorage Keys

| Key | Purpose | Used By |
|-----|---------|---------|
| `gameatica_playerName` | Player display name | All games |
| `gameatica_[game]_scores` | High scores array | Per game |
| `aiunites_clouddb_enabled` | Cloud sync toggle | CloudDB |
| `aiunites_clouddb_apiUrl` | Cloud API URL | CloudDB |

---

## Test Scenarios

### Hub Tests
- [ ] All 18 game cards display correctly
- [ ] Category filter buttons work
- [ ] Player name changes and persists
- [ ] Play count updates after playing games
- [ ] AIUNITES webring links work
- [ ] Mobile responsive layout

### Game Tests (Each Game)
- [ ] Game loads without errors
- [ ] Controls work (keyboard/mouse/touch)
- [ ] Score updates during gameplay
- [ ] High score saves after game over
- [ ] Game over modal displays
- [ ] "Play Again" button works
- [ ] "Back to Arcade" link works
- [ ] Leaderboard displays scores

### Mobile Tests
- [ ] Touch controls responsive
- [ ] Swipe gestures work (where applicable)
- [ ] D-pad buttons function
- [ ] Game canvas fits screen
- [ ] No horizontal scroll

---

## Known Issues / TODO

| Issue | Priority | Status |
|-------|----------|--------|
| Add more trivia questions | Low | 📲 TODO |
| Add sound on/off toggle | Medium | 📲 TODO |
| Add dark/light theme toggle | Low | 📲 TODO |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 17, 2026 | Initial landing page |
| 2.0.0 | Jan 25, 2026 | Full arcade with 13 games |

---

## Status Legend
- ✅ Implemented and tested
- ⬜ Not implemented
- 📲 TODO
- ⚠️ Partial/Issues
- ❌ Removed/Deprecated

---

*Document Version: 2.0*
*Last Updated: January 25, 2026*

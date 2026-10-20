# User Stories & Acceptance Criteria

## Context
This section lists the user stories for Traffix, our parking lot management simulator, and the acceptance criteria we'll use to check that each one works. Stories come from our proposal personas (Dr. Imani, Bartholomew) and Lab 2. Each story is tagged Now, Next or Later to match our prioritization, and the Now stories make up the MVP.

**EPIC:** Help drivers find an open parking spot quickly without circling the lot.

## Content

### US-1: Guided to the nearest open spot (Now)
As a university instructor, I want to be guided to the nearest open spot so that I'm not late for my lecture.
- Given the lot is more than 50% full, When I enter the lot, Then guide lights lead me to the nearest open spot.
- Given I'm following the guide lights, When I reach the target spot, Then the spot is marked as taken for other drivers.

### US-2: See which lots are full (Now)
As a store manager without a designated parking, I want to know which lots are completely full so that I don't waste time and I can reroute to a different lot.
- Given I've entered my destination, When I request parking options, Then each nearby lot shows how many spots are open.
- Given a lot has no open spots, When it appears in the list, Then it's marked as full and placed below lots with space.

### US-3: Park close to the building (Now)
As a dad doing grocery shopping, I want to know the closest open spot to my target building so that I don't have to walk far with my kid.
- Given I've entered my destination, When I request parking options, Then open spots are sorted by distance to the building.
- Given I select a spot, When I confirm it, Then I get directions to that spot.

### US-4: Redirected when my spot is taken (Next)
As a traveller catching a flight, I want to be redirected if my spot gets taken so that I don't miss my flight.
- Given my target spot gets taken before I reach it, When the system detects it, Then I'm redirected to the next closest open spot within 5 seconds.
- Given I've been redirected, When the new route is ready, Then the guide lights update to show the new path.

### US-5: Accessible parking (Next)
As a student with limited mobility, I want to be guided to the nearest accessible spot so that I don't have to travel far to the building.
- Given I'm registered as disabled, When I enter the lot, Then I'm guided to the nearest open accessible spot.
- Given all accessible spots are taken, When I enter the lot, Then I'm guided to the open regular spot closest to the building.

### US-6: Live lot occupancy (Now)
As a parking lot operator, I want to see the live status of every spot so that I know when the lot is getting congested.
- Given the simulation is running, When a car parks or leaves, Then that spot's status updates on the grid within 5 seconds.
- Given 50% or fewer spots are open, When I view the lot, Then it's marked as congested.

### US-7: Park away from other cars (Later)
As a driver who wants space around my car, I want to find a spot with no cars beside it so that my car is less likely to get damaged.
- Given the lot is less than 50% full, When I request a spot, Then I'm shown spots with no cars in the spots on either side.
- Given no such spot exists, When I request a spot, Then I'm shown the nearest open spot instead.

## Decisions (if any)
- A lot counts as congested when 50% or fewer of its spots are open - team, Lab 2
- Spot availability in the MVP is simulated data, not real sensors - team, proposal
- Accessible spots show open/taken status like regular spots (from peer test) - team, Lab 2

## Next Steps
- [ ] Confirm which Now stories are in the first build (<owner>, <date>)
- [ ] Add acceptance criteria for ticketing drivers who ignore guide lights (<owner>, <date>)
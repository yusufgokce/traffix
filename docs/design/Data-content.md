# Data & Content

## Context

This section describes the data and content needed for dynamic4Traffix, a parking lot management software simulator. The system will represent parking spaces, vehicles, parking sessions, and parking availability to help simulate how a parking lot operates.

## Content

### 1. Parking Spaces
- Each parking space should have a unique space ID.
- Each space should have a status, such as available or occupied.
- Spaces may include a location or section identifier to help users find them.
- The simulator should update space availability when vehicles enter or leave.

### 2. Vehicles
- Each vehicle should have a unique identifier.
- Vehicle information may include a license plate number and vehicle type.
- Vehicle records should be associated with their active parking sessions when applicable.

### 3. Parking Sessions
- Each parking session should have a unique session ID.
- A session should record the vehicle, assigned parking space, entry time, and exit time.
- The simulator may calculate parking duration using the entry and exit times.
- Active sessions should be distinguishable from completed sessions.

### 4. Parking Lot Information
- The system should represent the total number of parking spaces.
- It should display the number of available and occupied spaces.
- Parking availability should be updated when the status of a space changes.

### 5. Data Management
- Unique identifiers should be used to distinguish records.
- Data should remain consistent when vehicles enter, move through, or leave the simulated parking lot.
- Invalid operations, such as assigning an already occupied space, should be handled appropriately.
- The data structures and storage method will depend on the implementation selected by the development team.

## Decisions (if any)

- The proposed core data entities are Parking Spaces, Vehicles, and Parking Sessions — owner: Development Team, date: October 20, 2026.
- The team will confirm the final data structures and required vehicle information based on the project requirements.

## Next Steps

- [ ] Confirm the required data fields and features with the team (owner: Development Team, due date: TBD).
- [ ] Agree on the data structures and how parking availability will be updated (owner: Development Team, due date: TBD).
- [ ] Review this document through a GitHub Pull Request (owner: Document Author, due date: TBD).

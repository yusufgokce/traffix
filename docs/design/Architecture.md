# Architecture & Components

## 1. System Overview

The Smart Parking App is designed to help drivers find available parking spaces near their destinations. The system allows users to view parking locations, check availability, compare prices where information is available, get directions, and temporarily reserve parking spaces.

The system consists of a user interface, parking search and map component, reservation management component, notification component, backend services, and a database. These components work together to provide drivers with a convenient and reliable parking experience.

## 2. Main System Components

### 2.1 User Interface

The user interface is the part of the application that drivers interact with. It allows users to enter their destination, view available parking spaces, check parking details, and make or cancel reservations.

### 2.2 Parking Search and Map Component

This component helps drivers find parking spaces near their destinations. It displays parking locations and, where data is available, information about availability, distance, estimated travel time, and prices. Users can use this information to select a suitable parking space.

### 2.3 Reservation Management Component

This component manages temporary parking reservations. It allows users to reserve an available space for a limited period. The system must check that a space is still available before confirming a reservation. Once confirmed, the space should be unavailable to other users for the reservation period. Expired or cancelled reservations should release the space.

### 2.4 Notification Component

This component informs users about important reservation updates, including successful bookings, cancellations, expiration, and changes in availability. Notifications help drivers respond when their selected parking space is no longer available.

### 2.5 Backend Services

The backend processes requests from the user interface and coordinates the parking search, reservation, and notification components. It applies the application's rules, checks availability, and communicates with the database.

### 2.6 Database

The database stores information needed by the application, including parking locations, space availability, reservation details, and relevant user information. The backend reads and updates this information when users search for or reserve parking spaces.

## 3. Component Interactions

The components interact in the following way:

1. A driver enters a destination through the user interface.
2. The parking search component requests suitable parking information from the backend.
3. The backend retrieves the relevant information from the database and returns available parking options.
4. The driver selects a parking space and requests a temporary reservation.
5. The backend checks the current availability and confirms the reservation only if the space can still be reserved.
6. The database is updated, and the notification component informs the driver of the result.
7. If a reservation expires or is cancelled, the system releases the space so another driver can reserve it.

## 4. Key Architectural Considerations

- **Reliability:** The system should avoid confirming the same parking space to multiple drivers.
- **Usability:** Parking information and reservation steps should be simple and clear.
- **Scalability:** The design should allow additional parking locations and users to be supported as the application grows.
- **Privacy and security:** User and reservation information should be protected from unauthorized access.
- **Availability accuracy:** Parking information should be updated when reliable availability data is available. If live data is unavailable, the application should clearly communicate the limitations.

## 5. Assumptions and Dependencies

The application depends on having parking-location and availability information. Map and navigation services may be required to display parking locations and provide directions. Real-time availability and notifications will depend on the data sources and services available to the project.

## 6. Next Steps

- [ ] Confirm the system components with the project team.
- [ ] Agree on the programming languages, frameworks, and database to be used.
- [ ] Confirm which mapping and navigation services the application will use.
- [ ] Review how parking reservations, availability updates, and notifications will work together.
- [ ] Check that the architecture aligns with the team's user stories and acceptance criteria.
- [ ] Review and update this document based on feedback from team members.
- [ ] Commit the completed `Architecture.md` file and submit a pull request for review.

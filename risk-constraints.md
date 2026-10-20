# README: Risk Constraints & System Boundaries

This document outlines the core operational risks, system constraints, and functional boundaries for The Dynamic 4 parking management and guidance system (CS1161 Lab 2).

---

## 1. System Constraints & Operational Limits

The parking assistance system operates under strict environmental and technical boundaries to ensure safety, reliability, and fairness:

* **Lot Congestion Threshold (50% Rule):** 
  * **Low Congestion (<50% full):** The system displays a comprehensive grid of all empty spots and allows drivers flexibility in choosing their location, including options for premium or isolated parking away from adjacent vehicles.
  * **High Congestion (>50% full):** The system automatically switches logic to active guidance, utilizing physical guide lights to route drivers directly to the nearest available open space to minimize circling and traffic blockages.
* **Real-Time Latency Limit:** 
  * The system MUST update spot status and redirect the driver within **5 seconds** if their target spot is taken, because outdated information causes more circling and congestion.
* **Accessibility and Priority Constraints:** 
  * Accessible (disabled) parking spaces are restricted, and the app allows users to register as disabled to direct them to the nearest accessible spot, or the closest regular spot if none are free.

---

## 2. Identified Risks & Mitigation Strategies

| Risk Category | Description / Failure Mode | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Data Latency / Outdated Status** | Outdated information causes more circling and congestion when a target spot is taken. | High (Causes driver frustration, circling, and gridlock) | Implement a strict 5-second timeout rule to update spot status and redirect the driver if their target spot is taken. |
| **Enforcement & Compliance Failure** | Vehicles park outside a guided spot or in an accessible spot without registration. | Medium-High (Degrades system reliability and fairness) | Flag vehicles parked outside a guided spot or in an accessible spot without registration so they can be ticketed, keeping the guidance system reliable and protecting accessible spots. |
| **Peak Load Congestion** | High-volume events (e.g., when so many people are there on the first Saturday of the month) overwhelm available lot capacity. | High (Complete gridlock and prolonged search times) | Transition automatically to showing available parking spots during peak periods and guiding users along designated paths. |
| **Hardware / Sensor Failure** | Grid display or LED guide lights fail to register vehicle presence accurately. | Medium (Loss of automated routing trust) | Fallback to user-selected destination choices via the mobile app interface and peer-reviewed routing patterns. |

---

## 3. Compliance and Enforcement Policy

To maintain the integrity of the guidance system, the following operational protocols are enforced:
1. **Dynamic Rerouting:** Guide lights flash yellow when a spot is taken, and immediately flash green once a new route is calculated.
2. **Access Control:** The app reserves parking spaces closer to the destination, and guide lights flash RED quickly to show abled drivers that the spot is not for them, ensuring disabled parking spots are shown only to disabled people.

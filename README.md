# HireTrack

HireTrack is a browser-assisted job application tracking prototype designed to help students organize applications with less manual effort. The system combines a tracker interface, dashboard analytics, and an extension-assisted workflow for autofill and application capture.

## Features

- **Home / Add / Profile workflow**
    - View recent applications on the Home screen
    - Manually add and manage job applications in the Add tab
    - Save personal information in the Profile tab for reuse

- **Dashboard analytics**
    - View an application funnel across stages such as Applying, Applied, OA, Interview, Offer, and Rejected
    - Browse per-status summary cards
    - Track activity in a yearly heatmap
    - Search, filter, edit, and delete saved application records

- **Extension-assisted workflow**
    - Autofill job application fields using saved profile information
    - Capture key application information from a job page
    - Pre-fill tracker fields for user review before saving

- **Local persistence**
    - Store application data in the browser for easy testing and demo use

## Tech Stack

- React
- Vite
- JavaScript
- CSS
- Chrome Extension APIs

## Repository Structure

```text
.
├── public/
├── src/
├── background.js
├── content.js
├── dashboard.html
├── manifest.json
├── index.html
├── package.json
└── vite.config.js
```
## Getting Started
1. Clone the repository
```text
git clone https://github.com/davispham1/Hiretrack.git
cd Hiretrack
```

2. Install dependencies
```text
npm install
```

3. Start the development server
```text
   npm run dev
```
Then open the local Vite development URL shown in the terminal.



## Build for Extension Use

To create a production build:

```text
npm run build
```

After building, load the extension in Chrome:

1. Open chrome://extensions/ 
2. Turn on Developer mode 
3. Click Load unpacked 
4. Select the project folder or build output folder you want to test

## Demo Files

The repository also includes demo pages for testing the extension workflow on different job application layouts:

- demo-greenhouse.html 
- demo-indeed.html 
- demo-job-page.html 
- demo-lever.html 
- demo-linkedin.html 
- demo-workday.html 

## Current Scope

Currently implemented:
- Home/Add/Profile tracker workflow 
- Dashboard analytics and status views 
- Browser-side persistence 
- Extension-triggered autofill workflow 
- Page-to-tracker capture flow

Prototype-level or future work:

- Robust cross-site capture across many real job portals 
- Authentication 
- Cloud synchronization 
- Full backend services

## Limitations

HireTrack is currently a front-end prototype intended for demonstration and evaluation. Browser-side capture may vary across websites, and the project does not yet include a production backend, account system, or synchronized cloud storage.

## Authors
- Yuyang Sun 
- Davis Pham
- Brynn Li
- Wiley Hang
- Colin Mendoza
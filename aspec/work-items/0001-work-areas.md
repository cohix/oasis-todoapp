# Work Item: [Feature | Bug | Task]

Name: Work areas
Issue: issuelink
Overview:
- The user interface should include a top tab bar which splits todo items into 'Work areas'.

## Description
The high-level organizational concept in todoapp is 'Work Areas' these are distinct, named tabs in the user interface which allows for grouping todo items that are unrelated to one another.

Work areas should be represented as 'tabs' at the top of the UI. Each tab should display the work area's name.
The far-right of the tab bar should include a '+' button which allows adding a new work area, thus creating a new tab.
Each tab should include a '...' button to the right of the work area title which exposes a drop-down menu of options for the work area, initially the only option will be to rename the work area.
The tabs should resemble that of a browser, and resize accordingly depending on how many work areas there are.
Upon initial setup, there should be no existing work areas, only the '+' button, and the empty state screen should encourage the user to create a work area.

## User Stories

### User Story 1:
As a: user

I want to:
create a work area by clicking the + button. This shoud create a new tab, and the tab itself should include a text field where I can name the work area. When I press 'enter', the work area title should be saved and the UI for that specific work area should appear below. When I switch tabs, the list of todo items shown should refresh to only include the todo items in the current work area. Todo items can only belong to one work area.

So I can:
organize my todos.

### User Story 2:
As a: user

I want to:
rename a work area by clicking the '...' button found within each tab whenever I hover my mouse over it. I should be presented with a drop-down menu that includes an option to rename the work area. When I click the rename menu option, the tab title should turn into a text field which I can use to rename the work area, and pressing enter saves the change.

So I can:
rename my work areas.

## Implementation Guidance:
- make them act and feel like browser tabs
- allow me to drag tabs left and right to re-order them
- each work area and its details should be saved by using REST endpoints on the backend, and data stored in the backend component's SQLite database. No data should be stored locally in the browser.


## Edge case consideration:
- Duplicate work area names should not be allowed.


## Codebase integration:
- Implement the UI and the backend components seperately, they should communicate via REST API over HTTP using CRUD actions. Data stored in SQLite. Follow all guidelines from the aspec folder.
# Work Item: Feature

Name: Keyboard Navigation
Issue: issuelink
Overview:
- The user should be able to navigate work areas, bundles, and todo items using only their keyboard.

## Description
The frontend application should allow for navigation by keyboard alone if the user desires. This is in addition to mouse-based navigation.
Keyboard shortcuts that should be supported:
- Up/Down arrow: navigate up/down the todo item list within a work area, highlighting the selected item with a border. If further movement in the requested direction is not possible, the entire todo item list up and down should visibly shake as an error response.
- Left/Right arrow: navigate between work areas in the tab bar. If further movement in the requested direction is not possible, the tab bar should visibly shake left and right as an error response.
- W/S keys: move todo items into the bundle directly above (W) or below (S)
	- If an item is in the ungrouped portion of the list, W will move it up into the bottommost bundle
	- If an item is in the bottommost bundle, S will move it to the ungrouped area
	- If no bundles exist, W will cause the currently highlighted ungrouped item to be bundled with the item directly above it, as if it were dragged
	- If no bundles exist, S will cause the currently highlighted ungrouped item to be bundled with the item directly below it, as if it were dragged
- A/D keys: move todo items between work areas
	- A will move the currently highlighted todo item to the work area to the left of the current work area
		- If there is no work area to the left, the item will visibly shake as an error indicator and gently flash red
	- D will move the currently highlihghted todo item to the work area to the right of the current work area
		- If there is no work area to the right, the item will visibly shake as an error indicator and gently flash red
- T key: engage the new todo text field to create a new todo item (new item text box should become noticably highlighted)
- N key: create a new work area as if the + button in the tab bar was pressed

No todo item should be highlighted by default. If the up arrow is pressed when no item is selected, navigation should begin from the bottom of the list. If the down arrow is pressed when no item is selected, navigation should start from the top. If the Esc key is pressed, any currently highlighted item should be un-selected.



## User Stories

### User Story 1:
As a: user

I want to:
navigate the todo item list and work area tab bar with my keyboard

So I can:
operate todoapp without a mouse when desired

## Implementation Guidance:
- Error state shaking should approximate MacOS "incorrect password" behaviour


## Edge case consideration:
- No keyboard shortcuts should engage when any text box is currently in focus


## Codebase integration:
- use idiomatic react patterns for implementing keyboard navigation
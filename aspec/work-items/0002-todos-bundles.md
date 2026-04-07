# Work Item: Feature

Name: Todos and Bundles
Issue: issuelink
Overview:
- User should be able to create todo items in any of the available work areas. Each work area shoud have an independent list of todo items. Todo items should be groupable into 'bundles', showing distinctly as grouped in the user interface alongside other bundles.

## Description
Todo items are the main object in todoapp. Each todo item contains a title and a 'completed' status (todo, in progress, or completed).
Todo items can be bundled. By dragging a todo item onto another todo item, a bundle is created. Bundled items are grouped together in the work area's todo item list, and each bundle is given a distinct background color to easily distinguish them from one another.
A todo item can also be dragged into or out of an existing bundle to add it to a bundle or un-bundle it.
Un-bundled todo items should be shown un-grouped at the bottom of the work area's todo item list with no special colors.

## User Stories

### User Story 1:
As a: user

I want to:
Create a todo item with a specific title within a specific work area. New todos are automatically marked as `todo`.

So I can:
Record my tasks related to the current work area.

### User Story 2:
As a: user

I want to:
mark items as `in progress` or `completed` using buttons that appear when I hover over the todo item with my mouse.

So I can:
keep track of the progress of my todo items in the work area.

### User Story 3:
As a: user

I want to:
bundle multiple work items together into distinct groups by dragging and dropping them in the UI. I should be able to:
1. Create a new bundle by dragging one ungrouped todo item onto another ungrouped todo item
2. Add an ungrouped todo item to an existing bundle by dragging the todo item onto an exiting bundle
3. Remove a todo item from a bundle by dragging it out of an existing bundle into a designated area
4. Move a todo item from one bundle to another bundle by dragging it from one bundle to another bundle

So I can:
organize my todo items into bundles of related items.

## Implementation Guidance:
- There should be a persistent `New todo` text box at the top of each work area's tab
- There should be distinct and easy to understand "drop zones" whenever I begin to drag a todo item (i.e. each bundle should show a "drop zone" and there should be a distinct "ungroup drop zone" where I can drop a dragged item to bundle or un-bundle an item)
- Each bundle should have a title that can be set or changed by the user. When a new bundle is created, a text box should be shown inline with the new bundle to allow for naming, and a pencil icon should be shown next to the title so it can be modified.


## Edge case consideration:
- If a todo item is dragged from an existing bundle onto a todo item that is not currently within a bundle, a new bundle should be created similarly to when an ingrouped todo item is dragged onto another ungrouped todo item.


## Codebase integration:
- use modular react components, and follow REST API conventions described in the project architecture aspec.
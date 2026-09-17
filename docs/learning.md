# Walk through the system

The useful part of a portfolio project is being able to explain, change, and debug it. Work through these exercises with the repository running locally. Keep your own notes about what changed and how you verified it.

## Follow one request

Start at the evaluation form. Find where the selected languages and suite become JSON, then follow that request through the Node gateway, Python validation, worker process, oracle comparison, database insert, and browser result table. Explain which layer owns each error and why the browser is not trusted to validate input by itself.

## Frontend work

Add a search field for case names without losing the failure filter or pagination. Test empty results, changing the selected implementation, and opening a different historical run. Check keyboard access, focus visibility, and the mobile layout. Explain which state is local to a component and which belongs in the workbench hook.

## Backend and persistence

Open the same run in two browser sessions. Save a review in one, then try saving the old version in the other. Trace the conflict response to the SQL update. Explain why the current review and historical revision must share a transaction.

Add a new field only after deciding how existing database rows and old API clients should behave. Write a migration and a test that starts from an older schema. Do not erase a database to make a migration test pass.

## Language translation

Compare the five worker implementations. Explain sorting stability, empty output representation, integer validation, input copying, process errors, and JSON serialization in each language. Change one implementation to mishandle touching intervals and confirm the independent oracle rejects it.

Then fix the deliberately incorrect JavaScript variant yourself in a separate branch. Explain the failing case before editing the comparison. A repository containing a language is evidence of project exposure; proficiency requires being able to make and defend changes like this.

## Debugging and reliability

Temporarily make a worker sleep beyond its deadline. Verify that it is marked timeout rather than passed and that a subsequent evaluation still works. Restore the original implementation afterward. Try a read-only token, a malformed interval, and a stale review. Explain the difference between authentication, authorization, input validation, and concurrency control.

Run a backup, restore it into a separate database, and show the saved review. For AWS, repeat the recovery exercise from the deployment runbook and record the actual recovery time rather than an estimate.

## Discuss the architecture

- Why one container instead of a service for every language?
- Why SQLite for this version, and what changes before horizontal scaling?
- Why an independent oracle and an intentionally broken implementation?
- Why do process startup times make cross-language speed claims misleading?
- Why is a subprocess timeout not an arbitrary-code sandbox?
- What would be needed for individual identities, public access, and long-running jobs?

## Résumé wording

Keep this under **Portfolio Projects**, with the actual date and repository link. Do not fold newly explored technologies into past employment or claim four years of full-stack work on the strength of this application.

After you have run, understood, and personally extended it, a defensible description would be:

> Extended a full-stack evaluation workbench with a React/TypeScript interface, Node.js gateway, Python API, and SQLite persistence. Compared Python, JavaScript, Java, Go, and Rust implementations using shared contract tests; added and verified changes to the evaluation or review workflow.

Replace the final clause with the specific change you actually made. Describe AI assistance accurately if asked, and follow any application or assessment disclosure rules. Until AWS deployment and recovery are exercised, say **documented an AWS deployment plan**, not **operated the application in production**.

## Role alignment

| Requirement                      | Evidence this project can provide                      | What still needs independent evidence                         |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| Frontend and backend engineering | UI, state, API integration, validation, persistence    | Your own implementation and debugging decisions               |
| Multiple languages               | Five implementations with common test fixtures         | Depth beyond this one contract                                |
| Architecture                     | Documented boundaries and tradeoffs                    | Decisions made under real product and operational constraints |
| Correctness and code evaluation  | Oracle, boundary cases, mutation check, negative tests | Broader review experience and more demanding tasks            |
| Production experience            | Deployment and recovery runbooks                       | Actual deployment, operations, incidents, and ownership       |

There is no verified ATS score for this repository or résumé. Keyword coverage is only one aspect of matching; the posting's requirement for professional full-stack experience cannot be established by adding technology names. Use the project as concrete portfolio evidence and keep employment claims grounded in work you actually performed.

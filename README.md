# Advantages of cdk over plain cloudformation

* code reuse
* developer friendly
* version control
* debugging is super easy with console logs and debug points
* testing assertions
* intelliSense
* just change env file - for devOps
* no need to learn more about roles and security of aws
    - cdk allows for fine grained access, saying this lambda can send message only to this queue
    - this queue can listen to messages only from this lambda level refinement
* helps in localstack testing
* we can export some queue from one stack and use it on another to grant access to the next lambda
    - using cdk is far easier to maintain than cloudformation
        - Join, ImportValue, ExportValue from cloudformation.yaml syntax is weird
        - cdk allows typescript hence importing and exporting or any logical operations is super easy
* define project specific things - say tags
    - some tags like product owner, environment, etc from .env and developers can use V3Queue instead of Queue from aws
        - here we can include all tags that we need for all supported resources
            - rather than developers manually exploring which all resources support tags and add them accordingly
## Useful commands

* `npm run deploy`   deploy all the stacks
* `npm run deployY`   deploy all the stacks without approval

curl ^
    -X POST "http://admin-backup:manager@localhost:5985/_replicator"
    -d "{"^
        "\"_id\": \"test-backup\""^
        "\"source\": \"https://localhost:6984/expenses-dev\""^
        ""^
        "}"

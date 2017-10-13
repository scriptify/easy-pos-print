# POS print server

A simple print server for printing orders, qr-codes and a tiny welcome message.

## Usage (API-Endpoints)

There are 4 API-Endpoints:

### Checking availability
#### /is-available
Before using the other endpoints, you can use this endpoint to check if there is an available printer.
If everything is setup, it returns:

```javascript
{
  isAvailable: true
}
```

Otherwise:

```javascript
{
  isAvailable: false
}
```

### Printing a welcome message
#### /welcome
Print a simple welcome message


# Interested?
There's not much flexible functionality yet. But if you are interested in this project, open an issue and we'll see what can be done.

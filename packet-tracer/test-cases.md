# Packet Tracer Test Cases

## Test Case 1: Normal Network

### What Changed
The network was configured normally with correct IP addresses,
subnet masks, default gateways, and router interfaces.

### Symptom
All devices could communicate successfully.

### Command/Test Used

From PC0:

    ping 192.168.1.1

Result: Successful replies.

Then:

    ping 192.168.2.10

Result: Successful replies.

### Correct Fix
No fix was required because the network was correctly configured.

### Result
PASS - Normal network connectivity worked successfully.

---

## Test Case 2: Wrong Gateway

### What Changed
The default gateway of PC0 was changed from:

    192.168.1.1

to:

    192.168.1.254

### Symptom
PC0 could not reach the remote network.

### Command/Test Used

From PC0:

    ping 192.168.2.10

Result:

    Request timed out.

The PC configuration was checked using:

    ipconfig

The output showed:

    Default Gateway: 192.168.1.254

### Correct Fix
The default gateway on PC0 was changed back to:

    192.168.1.1

The ping was tested again and succeeded.

### Result
PASS - The wrong gateway was identified and corrected.

---

## Test Case 3: Missing Route

### What Changed
The route from Router0 to the remote network 192.168.2.0/24
was initially missing.

### Symptom
PC0 could not reach PC1 on the remote network.

### Command/Test Used

On Router0:

    show ip route

The routing table did not contain a route to:

    192.168.2.0/24

From PC0:

    ping 192.168.2.10

Result:

    Reply from 192.168.1.1: Destination host unreachable.

Packet loss:

    100% loss

### Correct Fix
A static route was added to Router0:

    ip route 192.168.2.0 255.255.255.0 10.0.0.2

A return route was also configured on Router1:

    ip route 192.168.1.0 255.255.255.0 10.0.0.1

The routing tables were verified using:

    show ip route

Finally, from PC0:

    ping 192.168.2.10

The ping succeeded.

### Result
PASS - The missing route was identified and the routing configuration was corrected.

---

## Summary

| Test Case | Problem | Symptom | Test/Command | Correct Fix |
|---|---|---|---|---|
| Normal Network | No problem | Connectivity works | ping | No fix required |
| Wrong Gateway | Incorrect gateway | Remote ping fails | ipconfig, ping | Correct gateway |
| Missing Route | Route missing | Remote ping fails | show ip route, ping | Add static route |

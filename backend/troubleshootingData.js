const troubleshootingData = [
  {
    problem: "Wrong IP Address",
    check: "ipconfig / show ip interface",
    solution: "Assign the correct IP address and subnet mask."
  },
  {
    problem: "Wrong Default Gateway",
    check: "ipconfig / show running-config",
    solution: "Set the correct default gateway address."
  },
  {
    problem: "VLAN Problem",
    check: "show vlan brief",
    solution: "Create the required VLAN and assign the port to the correct VLAN."
  },
  {
    problem: "Trunk Problem",
    check: "show interfaces trunk",
    solution: "Configure the interface as a trunk and allow the required VLANs."
  },
  {
    problem: "Missing Route",
    check: "show ip route",
    solution: "Add the required static route or configure the appropriate routing protocol."
  },
  {
    problem: "DHCP Problem",
    check: "ipconfig /all / show ip dhcp binding",
    solution: "Check the DHCP pool, available addresses, server connectivity, and DHCP configuration."
  },
  {
    problem: "DNS Problem",
    check: "nslookup google.com",
    solution: "Configure the correct DNS server and verify DNS connectivity."
  },
  {
    problem: "NAT Problem",
    check: "show ip nat translations / show ip nat statistics",
    solution: "Check NAT rules and verify inside and outside interfaces."
  },
  {
    problem: "Interface Down",
    check: "show ip interface brief",
    solution: "Enable the interface using 'no shutdown' and check the physical connection."
  },
  {
    problem: "Duplicate IP Address",
    check: "arp -a / show ip arp",
    solution: "Find the conflicting device and assign it a unique IP address."
  },
  {
    problem: "Cannot Reach Default Gateway",
    check: "ping <gateway>",
    solution: "Check the IP address, subnet mask, VLAN, cable, and gateway configuration."
  },
  {
    problem: "Cannot Reach Remote Network",
    check: "ping <remote-IP> / traceroute",
    solution: "Check the routing table and add or correct the required route."
  },
  {
    problem: "ACL Blocking Traffic",
    check: "show access-lists",
    solution: "Modify the ACL to permit the required traffic."
  },
  {
    problem: "Firewall Blocking Traffic",
    check: "Check firewall rules and logs",
    solution: "Allow the required IP, port, or protocol through the firewall."
  },
  {
    problem: "Packet Loss",
    check: "ping / traceroute",
    solution: "Check cables, interface errors, congestion, and network devices along the path."
  },
  {
    problem: "High Latency",
    check: "ping / traceroute",
    solution: "Check network congestion, bandwidth usage, routing path, and overloaded devices."
  },
  {
    problem: "Wi-Fi Connection Problem",
    check: "Check Wi-Fi status and signal strength",
    solution: "Verify SSID, password, signal strength, IP configuration, and access-point connectivity."
  },
  {
    problem: "DHCP Relay Problem",
    check: "show running-config / show ip interface",
    solution: "Configure the correct 'ip helper-address' on the router interface."
  },
  {
    problem: "Routing Protocol Not Working",
    check: "show ip protocols / show ip route",
    solution: "Check network statements, neighbors, and routing protocol configuration."
  },
  {
    problem: "Default Route Missing",
    check: "show ip route",
    solution: "Configure a default route using 'ip route 0.0.0.0 0.0.0.0 <next-hop>'."
  }
];

module.exports = troubleshootingData;
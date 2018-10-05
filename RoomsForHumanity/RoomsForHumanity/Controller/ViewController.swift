//
//  ViewController.swift
//  RoomsForHumanity
//
//  Created by Jocelyn Ragukonis on 9/21/18.
//  Copyright © 2018 Jocelyn Ragukonis. All rights reserved.
//

import UIKit

class ViewController: UIViewController {
    
    var roomName: String = "#"
    var userID: String = ""
    
    @IBOutlet weak var roomNameField: UITextField!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        // Do any additional setup after loading the view, typically from a nib.
        
        SocketIOManager.sharedInstance.establishConnection()
        userID = SocketIOManager.sharedInstance.createUserID()
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        // Dispose of any resources that can be recreated.
    }

    @IBAction func enterTapped(_ sender: Any) {
        roomName = "#" + roomNameField.text!
        print("roomName: ", roomName)
        
        SocketIOManager.sharedInstance.publish(userID: userID, roomName: roomName)
        SocketIOManager.sharedInstance.subscribe(userID: userID, roomName: roomName)
    }
    
    
}


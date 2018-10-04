//
//  ViewController.swift
//  RoomsForHumanity
//
//  Created by Jocelyn Ragukonis on 9/21/18.
//  Copyright © 2018 Jocelyn Ragukonis. All rights reserved.
//

import UIKit

class ViewController: UIViewController {
    

    override func viewDidLoad() {
        super.viewDidLoad()
        // Do any additional setup after loading the view, typically from a nib.
        
        SocketIOManager.sharedInstance.establishConnection()
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        // Dispose of any resources that can be recreated.
    }


}


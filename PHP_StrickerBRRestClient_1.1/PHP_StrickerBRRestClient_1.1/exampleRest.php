<?php

/*
 * 
 * Example API Stricker Version 1.1
 * 
 */

set_time_limit(0);

// Include the client soap to communicate with the webservice methods
require_once("StrickerRestClient.php");

// Create a new instance for the webservice client
$key = "";
$protocol = "http";
$webservice = new StrickerRestClient($key, $protocol);

#region Validate Token
$webservice->ValidateToken(); 
#endregion

#region Get Products Tree
// $data = $webservice->GetProductsTree();
// echo "Products Tree :". print_r($data);
#endregion

#region Get Products 
// $data = $webservice->GetProducts();
// echo "Products :". print_r($data);
#endregion

#region Get Optionals 
// $data = $webservice->GetOptionals();
// echo "Optionals :". print_r($data);
#endregion

#region Get Optionals Complete
// $data = $webservice->GetOptionalsComplete();
// echo "Optionals Complete :". print_r($data);
#endregion

#region Get Customization Options
// $data = $webservice->GetCustomizationsOptions();
// echo "Customization Options :". print_r($data);
#endregion

#region Get Customization Tables
// $data = $webservice->GetCustomizationsTables();
// echo "Customization Tables :". print_r($data);
#endregion

#region Get Stocks
// $data = $webservice->GetStocks();
// echo "Stocks :". print_r($data);
#endregion

#region Get Product Types
//$data = $webservice->GetProductTypes();
//echo 'Product Types :<br/><pre>'; print_r($data); echo '</pre>';

#endregion

#region Get Colors
// $data = $webservice->GetColors();
// echo "Colors :". print_r($data);
#endregion

#region Get Catalog Prices
 $data = $webservice->GetCatalogPrices();
 echo "Catalog Prices :". print_r($data);
#endregion

#region Maker Order & Order With ArtWork

// $orderLine1 = array( 'LineType' => 'Simple', 'Sku' => '30504-103-P', 'Quantity' => '1' );
// $orderLine2 = array( 
//     'LineType' => 'PRINT',
//     'Sku' => '30504-103-P', 
//     'Quantity' => '1',
//     'WaitArtWork' => true
//     );
// $order = array($orderLine1,$orderLine2);

// $destination = array(
//     'AddressLine1' => 'Street name',
//     'AddressLine2' => 'Door number',
//     'Postalcode' => '1000',
//     'ExtentionPostalcode' => '',
//     'City' => 'City',
//     'Country' => 'BR',
//     'PhoneNumber' => '93243232',
//	   'State' => 'SP',
// );
// $internalReference = "";

// //For development purposes

// $test = true;
// $data = $webservice->CreateOrder($order, $destination, "ECONOMY", "Testing", $internalReference, null, null, false, $test);

// echo "Information :". print_r($data);

// // Insert Order with ArtWork

// $orderStamp = $data->OrderV1Result->OrderDetails->OrderStamp;
// $objectOrderLine = null;
// foreach ($data->OrderV1Result->OrderDetails->OrderLines as $key => $value) {
//     $objectOrderLine = $value;

//     $status = $objectOrderLine->Status;

//     // NOTE VERY IMPORTANT -> You must save $objectOrderLine->OrderLineStamp in your system in order to process the art work later.

//     if(trim($status) == "WAITING_ART_WORK"){
//         $OrderLineStamp = $objectOrderLine->OrderLineStamp;

//         $filename = "test.png"; 

//         $handle = fopen($filename, "rb"); 
//         $fsize = filesize($filename); 
//         $contents = fread($handle, $fsize); 
//         $byteArr = str_split($contents);
//         foreach ($byteArr as $key=>$val)
//         { 
//              $byteArr[$key] = ord($val);
//         }

//         $arrayServiceFiles = array(
//             array(
//                     "FileName" => "test",
//                     "FileExtension" => ".png",
//                     "FileBytes" => $byteArr
//                 )
//         );

//         $arrayOrderServiceOrder = array(
//             array(
//                 "OrderLineStamp" => $OrderLineStamp,
//                 "Appproved" => true,
//                 "LogoArea" => 2.25,
//                 "LogoHeight" => 1.5,
//                 "LogoWidth" => 1.5,
//                 "ServCode" => "30504.39.40.TRS1-01-03",
//                 "Files" => $arrayServiceFiles
//             )
//         );

//         $data = $webservice->CreateOrderWithArtWork($orderStamp, $arrayOrderServiceOrder, $test);
//         echo 'Orders :<br/><pre>'; print_r($data); echo '</pre>';

//     }
// }

#endregion

#region Get Canceled Products
 //$data = $webservice->GetCanceledProducts();
 //echo "Canceled products:". print_r($data);
#endregion

?>
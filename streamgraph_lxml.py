#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Fabian Ehrentraud, 2011
# e0725639@mail.student.tuwien.ac.at
# Licensed under the Open Software License (OSL 3.0)
# Scrapes TU Vienna Statistics from TISS
# needs Python 2.7 and library lxml

import datetime
from collections import OrderedDict
from lxml import etree
from lxml import html
import urllib
import os.path


#TODO
#http://docs.python.org/howto/webservers.html


xmlfilename = "streamgraph_inskriptionen.xml"
xmlcomment = "\nBarbara Csarman, Fabian Ehrentraud, 2011\n"
xsd = "datasets.xsd"
xmlRootname = "datasets"

#tiss = "https://tiss.tuwien.ac.at/statistik/public_lehre/aktive_studierende_nach_nationalitaet"
tiss = "https://tiss.tuwien.ac.at/statistik/public_lehre/inskriptionen_pro_studienrichtung"



""" create xml """

def makeRoot(rootname=xmlRootname, schema=xsd, comment=xmlcomment): #, xsltstylesheet=xslt):
	#creates an stpl xml with xslt PI
	root = etree.Element(rootname, nsmap={"xsi": "http://www.w3.org/2001/XMLSchema-instance"}, attrib={"{http://www.w3.org/2001/XMLSchema-instance}noNamespaceSchemaLocation": schema})
	root.addprevious(etree.Comment(comment))

	#root.addprevious(etree.PI("xml-stylesheet", 'type="text/xsl" href="%s"'%(xsltstylesheet)))

	return root


def addInfo(xml_root, graph_title, x_axis_name, y_axis_name):
	""" adds a graph information to the given xml.  has to be called before adding datasets to follow xsd element order """
	
	graph_title_ = etree.SubElement(xml_root, "title")
	graph_title_.text = (graph_title or "").strip()
	
	x_axis_name_ = etree.SubElement(xml_root, "x_axis")
	x_axis_name_.text = (x_axis_name or "").strip()
	
	y_axis_name_ = etree.SubElement(xml_root, "y_axis")
	y_axis_name_.text = (y_axis_name or "").strip()
	
	
	return xml_root


def addDataset(xml_root, dataset_title, points):
	""" adds a dataset to the given xml """
	
	dataset_ = etree.SubElement(xml_root, "dataset")
	dataset_title_ = etree.SubElement(dataset_, "title")
	dataset_title_.text = (dataset_title or "").strip()
	
	for (x, y) in points:
		point_ = etree.SubElement(dataset_, "point")
		x_value_ = etree.SubElement(point_, "x_value")
		x_value_.text = (x or "").strip()
		y_value_ = etree.SubElement(point_, "y_value")
		y_value_.text = (y or "").strip()
	
	return dataset_


def checkSchema(xml_root, xsd=xsd):
	#checks whether the given xml is correct according to the schema
	
	#TODO extract schema from xml
	
	xmlschema_doc = etree.parse(xsd)
	xmlschema = etree.XMLSchema(xmlschema_doc)

	#print(xmlschema.validate(doc))
	try:
		xmlschema.assertValid(xml_root)
		return True
	except etree.DocumentInvalid:
		print(xmlschema.error_log)
		return False

def writeXml(xml_root, filename=xmlfilename):
	#writes xml to the given filename
	
	print("Writing XML file " + filename) # + " + backups")
	
	xml = etree.tostring(xml_root.getroottree(), pretty_print=True, xml_declaration=True, encoding="utf-8")

	#print(xml) #unicode problem
	
	writedate = str(datetime.datetime.now()).replace(":",".").replace(" ","_")

	basename, extension = os.path.splitext(filename)
	
	"""
	#backup of original if it exists
	if os.path.exists(filename):
		os.rename(filename, basename + "_" + writedate + "_old" + extension)
	"""
	
	#write new
	f = open(filename, 'w')
	f.write(xml)
	f.close()
	
	"""
	#write backup of new
	f = open(basename + "_" + writedate + extension, "w")
	f.write(xml)
	f.close()
	"""

"""
def readXml(filename, checkXmlSchema=False):
	
	print("Reading in existing XML file " + filename)
	
	parser = etree.XMLParser(remove_blank_text=True) #read in a pretty printed xml and don't interpret whitespaces as meaningful data => this allows correct output pretty printing
	xml_root = etree.parse(filename, parser).getroot()

	#print(etree.tostring(xml_root))
	
	if checkXmlSchema:
		if not checkSchema(xml_root):
			raise Exception("Verifying XML Schema failed")
	
	return xml_root

def loadXml(xmlfilename, xmlRootname=xmlRootname, xsd=xsd, loadExisting=True, checkXmlSchema=False):
	#open existing file if it exists or create new xml
	#check xml only when file is opened
	if loadExisting and os.path.exists(xmlfilename):
		#open existing file
		return readXml(xmlfilename, checkXmlSchema)
	else:
		#create xml
		return makeRoot(xmlRootname, xsd)


def transformXslt(xml_root, xsltfilename=rss_xslt):
	xslt_root = readXml(xsltfilename)
	transform = etree.XSLT(xslt_root)
	return transform(xml_root).getroot()

"""


def getSemesterUrls(baseurl):
	#builds urls of websites with all semester's statistic
	print("Querying %s"%(baseurl))
	
	#doc = html.parse(baseurl).getroot()
	
	#stupid workaround necessary due to https
	html_ = urllib.urlopen(baseurl)
	#xml = html.read()
	#doc = etree.fromstring(xml, base_url=url)
	doc = html.parse(html_).getroot()
	
	doc.make_links_absolute(baseurl)
	
	title = doc.xpath('//h2/following-sibling::form/text()')[0].strip() #as h2 is not allowed to hold block-level elements, the lxml parser closes the tag making the contained elements following siblings...
	print(title)
	
	options = doc.xpath('//select[contains(@id,"semester")]/option')
	
	urls = []
	
	for o in options:
		#urls[o.text] = baseurl+"/"+o.attrib.get("value")
		urls.append((o.text, baseurl+"/"+o.attrib.get("value")))
		#print(o.text)
		#print(o.attrib.get("value"))
	
	urls.reverse()
	
	#print(urls)
	
	return (title, urls)

	
	
	

""" TISS scraping """

def getTISS(xml_root, baseurl):
	#gets data from given url (Tiss) and writes to xml

	statistic_title, urls = getSemesterUrls(baseurl)
	
	x_axis = "Semester"
	y_axis = "Inskribierte Studien" #TODO scrape?
	
	addInfo(xml_root, graph_title=statistic_title, x_axis_name=x_axis, y_axis_name=y_axis)
	
	all_datasets = dict()
	
	read_semesters = []

	for semester, url in urls:
		print("Scraping %s"%(url))
		#print(semester + " - " + url)
		
		#doc = html.parse(url).getroot()
		
		#stupid workaround necessary due to https
		html_ = urllib.urlopen(url)
		#xml = html.read()
		#doc = etree.fromstring(xml, base_url=url)
		doc = html.parse(html_).getroot()
		doc.make_links_absolute(url)
		
		#print(etree.tostring(doc))
	
		
		statistic_table = doc.xpath('//table')

		if len(statistic_table) == 0:
			continue
			#raise Exception("No table found in %s"%(url))
		else:
			read_semesters.append(semester)

		x_value = semester
		
		#headers = statistic_table[0].xpath('//thead/tr/th')
		
		#1=Inländer, 2=Ausländer, 3=männlich, 4=weiblich, 5=Beginn, 6=Fortsetzungen, 7=Summe
		count = statistic_table[0].xpath('//tr/td[7]')

		#for h in headers:
		for c in count:
			
			title2 = c.xpath('preceding-sibling::th')[0].text
			
			if "summe" in title2.lower():
				break

			title1 = c.xpath('../preceding-sibling::tr[th/@rowspan][1]/th')[0].text
			
			title = " - ".join(title1.split(u"\xa0", 1)) + " - " + title2 #\xa0 is non-breaking space
			
			y_value = c.text
			
			
			if title not in all_datasets:
				all_datasets[title] = []
			
			
			all_datasets[title].append((x_value, y_value))
			
			#print(title)
			#print(y_value)

		#print(all_datasets)
		#raise Exception()
	
	#print(all_datasets)
	#raise Exception()
	
	for dataset_title, dataset_points in all_datasets.items():
	
		full_dataset_points = [] #generate missing 0 values
		
		indexed_dict = dict()
		for point in dataset_points:
			indexed_dict[point[0]] = point
		
		for semester in read_semesters:
			if semester in indexed_dict:
				full_dataset_points.append(indexed_dict[semester])
			else:
				full_dataset_points.append((semester, "0"))
		
		addDataset(xml_root, dataset_title, full_dataset_points)
		#addDataset(xml_root, dataset_title, dataset_points)




""" program script """


"""
x="Bla %s"%(u"ÄäÖöÜüß")
print(x)
raise Exception(x) #FIXME no unicode exception messages
"""


#create new xml
xml_root = makeRoot(xmlRootname, xsd, xmlcomment)



#get statistics from TISS
getTISS(xml_root, tiss)

#raise Exception()

"""
#check if generated xml is correct regarding xsd
if(checkSchema(xml_root)):
	print("XML is valid")
else:
	print("XML is NOT valid")
"""

#write xml to file + backupfile
writeXml(xml_root, filename=xmlfilename)
